import AVFoundation
import CoreMotion
import ExpoModulesCore
import QuartzCore
import UIKit
import Vision

final class SensorStartException: GenericException<String> {
  override var reason: String {
    param
  }
}

private struct RegionStats {
  var r = 0.0
  var g = 0.0
  var b = 0.0
  var count = 0
  var saturated = 0
  var dark = 0

  mutating func add(_ other: RegionStats) {
    r += other.r
    g += other.g
    b += other.b
    count += other.count
    saturated += other.saturated
    dark += other.dark
  }
}

/// Owns every capture resource so only one sensor experiment can run at a time.
/// Raw frames and audio buffers are reduced to a few numbers on device and then discarded.
final class SensorEngine: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate, AVCaptureDepthDataOutputDelegate {
  static let shared = SensorEngine()

  let session = AVCaptureSession()
  var emit: ((String, [String: Any?]) -> Void)?

  private let controlQueue = DispatchQueue(label: "ai.nightsignal.control")
  private let controlQueueKey = DispatchSpecificKey<Bool>()
  private let captureQueue = DispatchQueue(label: "ai.nightsignal.capture")
  private let motionManager = CMMotionManager()
  private let motionQueue = OperationQueue()
  private var audioEngine: AVAudioEngine?
  private var activeKind: String?
  private var activeDevice: AVCaptureDevice?
  private var runToken = 0
  private var frameIndex = 0
  private var latestMotion = 0.0
  private var lastFaceRect: CGRect?
  private var lastFaceSeen = -Double.infinity
  private var lastDepthEmit = -Double.infinity
  private var lastAudioEmit = -Double.infinity
  private var chestRoi = CGRect(x: 0.3, y: 0.45, width: 0.4, height: 0.25)
  private var observers: [NSObjectProtocol] = []
  private let requestLock = NSLock()
  private var requestTicket = 0

  static let maxSessionSeconds = 30.0
  private static let torchAttempts = 8
  private static let torchRetryDelay: TimeInterval = 0.15

  private override init() {
    super.init()
    controlQueue.setSpecific(key: controlQueueKey, value: true)
    let center = NotificationCenter.default
    observers.append(center.addObserver(forName: AVCaptureSession.wasInterruptedNotification, object: session, queue: nil) { [weak self] _ in
      self?.stopIfActive(["ppg", "face", "depth"], reason: "capture_interrupted")
    })
    observers.append(center.addObserver(forName: AVCaptureSession.runtimeErrorNotification, object: session, queue: nil) { [weak self] _ in
      self?.stopIfActive(["ppg", "face", "depth"], reason: "capture_error")
    })
    observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: nil) { [weak self] note in
      guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
            AVAudioSession.InterruptionType(rawValue: raw) == .began else { return }
      self?.stopIfActive(["audio"], reason: "audio_interrupted")
    })
    observers.append(center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: nil) { [weak self] _ in
      self?.stop(reason: "app_inactive")
    })
  }

  // MARK: Availability and permissions

  static func cameraPermission() -> String {
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized: return "granted"
    case .denied, .restricted: return "denied"
    case .notDetermined: return "undetermined"
    @unknown default: return "undetermined"
    }
  }

  static func microphonePermission() -> String {
    if #available(iOS 17.0, *) {
      switch AVAudioApplication.shared.recordPermission {
      case .granted: return "granted"
      case .denied: return "denied"
      case .undetermined: return "undetermined"
      @unknown default: return "undetermined"
      }
    }
    switch AVAudioSession.sharedInstance().recordPermission {
    case .granted: return "granted"
    case .denied: return "denied"
    case .undetermined: return "undetermined"
    @unknown default: return "undetermined"
    }
  }

  static func requestMicrophonePermission(_ completion: @escaping (Bool) -> Void) {
    if #available(iOS 17.0, *) {
      AVAudioApplication.requestRecordPermission(completionHandler: completion)
    } else {
      AVAudioSession.sharedInstance().requestRecordPermission(completion)
    }
  }

  func availability() -> [String: Any] {
    #if targetEnvironment(simulator)
    let isSimulator = true
    #else
    let isSimulator = false
    #endif
    let back = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back)
    let front = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front)
    let trueDepth = AVCaptureDevice.default(.builtInTrueDepthCamera, for: .video, position: .front)
    let trueDepthSupportsDepth = trueDepth?.formats.contains { !$0.supportedDepthDataFormats.isEmpty } ?? false
    return [
      "nativeModule": true,
      "isSimulator": isSimulator,
      "backCamera": back != nil,
      "torch": back?.hasTorch ?? false,
      "frontCamera": front != nil,
      "trueDepth": trueDepthSupportsDepth,
      "microphone": AVAudioSession.sharedInstance().isInputAvailable,
      "deviceMotion": motionManager.isDeviceMotionAvailable,
      "cameraPermission": SensorEngine.cameraPermission(),
      "microphonePermission": SensorEngine.microphonePermission(),
    ]
  }

  func setChestRoi(x: Double, y: Double, width: Double, height: Double) {
    let clamped = CGRect(x: x, y: y, width: width, height: height).intersection(CGRect(x: 0, y: 0, width: 1, height: 1))
    guard !clamped.isNull, clamped.width > 0.02, clamped.height > 0.02 else { return }
    captureQueue.async { self.chestRoi = clamped }
  }

  // MARK: Lifecycle

  func start(kind: String, options: [String: Any]) throws {
    let maxSeconds = max(5.0, min(SensorEngine.maxSessionSeconds, (options["maxSeconds"] as? Double) ?? SensorEngine.maxSessionSeconds))
    let torchLevel = max(0.05, min(0.6, (options["torchLevel"] as? Double) ?? 0.3))
    let ticket = takeRequestTicket()
    var thrown: Error?
    controlQueue.sync {
      guard isCurrentRequest(ticket) else {
        thrown = SensorStartException("Start was cancelled.")
        return
      }
      stopLocked(reason: "switching_mode")
      do {
        switch kind {
        case "ppg": try startPpg(torchLevel: Float(torchLevel), ticket: ticket)
        case "face": try startFace()
        case "depth": try startDepth()
        case "audio": try startAudio()
        default: throw SensorStartException("Unknown sensor kind \(kind)")
        }
        try ensureCurrentRequest(ticket)
        frameIndex = 0
        activeKind = kind
        runToken += 1
        let token = runToken
        DispatchQueue.main.asyncAfter(deadline: .now() + maxSeconds) { [weak self] in
          guard let self else { return }
          self.controlQueue.async {
            guard self.runToken == token, self.activeKind != nil else { return }
            self.stopLocked(reason: "session_limit")
          }
        }
        emit?("onStatus", ["state": "running", "kind": kind])
      } catch {
        stopLocked(reason: "start_failed")
        thrown = error
      }
    }
    if let thrown { throw thrown }
  }

  private func stopIfActive(_ kinds: Set<String>, reason: String) {
    controlQueue.async {
      guard let kind = self.activeKind, kinds.contains(kind) else { return }
      self.stopLocked(reason: reason)
    }
  }

  /// Every start and every stop takes a new ticket before it waits for the control queue. A request
  /// whose ticket is no longer current when it runs does nothing, so a pending stop cancels the start
  /// in flight, and neither a stale start nor a stale stop can touch a newer start.
  private func takeRequestTicket() -> Int {
    requestLock.lock()
    defer { requestLock.unlock() }
    requestTicket += 1
    return requestTicket
  }

  private func isCurrentRequest(_ ticket: Int) -> Bool {
    requestLock.lock()
    defer { requestLock.unlock() }
    return requestTicket == ticket
  }

  private func ensureCurrentRequest(_ ticket: Int) throws {
    guard isCurrentRequest(ticket) else {
      throw SensorStartException("Start was cancelled.")
    }
  }

  func stop(reason: String) {
    let ticket = takeRequestTicket()
    if DispatchQueue.getSpecific(key: controlQueueKey) == true {
      if isCurrentRequest(ticket) {
        stopLocked(reason: reason)
      }
    } else {
      controlQueue.sync {
        guard isCurrentRequest(ticket) else { return }
        stopLocked(reason: reason)
      }
    }
  }

  private func stopLocked(reason: String) {
    let wasActive = activeKind
    activeKind = nil
    runToken += 1
    if let device = activeDevice {
      turnTorchOff(device)
    }
    if session.isRunning {
      session.stopRunning()
    }
    if !session.inputs.isEmpty || !session.outputs.isEmpty {
      session.beginConfiguration()
      session.inputs.forEach { session.removeInput($0) }
      session.outputs.forEach { session.removeOutput($0) }
      session.commitConfiguration()
    }
    if motionManager.isDeviceMotionActive {
      motionManager.stopDeviceMotionUpdates()
    }
    if let engine = audioEngine {
      engine.inputNode.removeTap(onBus: 0)
      engine.stop()
      audioEngine = nil
      try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
    activeDevice = nil
    lastFaceRect = nil
    latestMotion = 0
    if let kind = wasActive {
      emit?("onStatus", ["state": "stopped", "kind": kind, "reason": reason])
    }
  }

  // MARK: Camera configuration

  private func configureInput(_ device: AVCaptureDevice, preset: AVCaptureSession.Preset) throws {
    guard SensorEngine.cameraPermission() == "granted" else {
      throw SensorStartException("Camera permission not granted")
    }
    if session.canSetSessionPreset(preset) {
      session.sessionPreset = preset
    }
    let input: AVCaptureDeviceInput
    do {
      input = try AVCaptureDeviceInput(device: device)
    } catch {
      throw SensorStartException("Could not open camera: \(error.localizedDescription)")
    }
    guard session.canAddInput(input) else {
      throw SensorStartException("Camera input could not be added")
    }
    session.addInput(input)
    activeDevice = device
  }

  private func addVideoOutput() throws {
    let output = AVCaptureVideoDataOutput()
    output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
    output.alwaysDiscardsLateVideoFrames = true
    output.setSampleBufferDelegate(self, queue: captureQueue)
    guard session.canAddOutput(output) else {
      throw SensorStartException("Video output could not be added")
    }
    session.addOutput(output)
    if let connection = output.connection(with: .video) {
      setPortrait(connection)
    }
  }

  private func setPortrait(_ connection: AVCaptureConnection) {
    if #available(iOS 17.0, *) {
      if connection.isVideoRotationAngleSupported(90) {
        connection.videoRotationAngle = 90
      }
    } else if connection.isVideoOrientationSupported {
      connection.videoOrientation = .portrait
    }
  }

  private func turnTorchOff(_ device: AVCaptureDevice) {
    guard device.hasTorch, device.torchMode != .off || device.isTorchActive else { return }
    do {
      try device.lockForConfiguration()
      defer { device.unlockForConfiguration() }
      if device.isTorchModeSupported(.off) {
        device.torchMode = .off
      }
    } catch {}
  }

  /// Turns the torch on at a reduced level once the capture session is running, then confirms
  /// with isTorchActive. isTorchAvailable can be briefly false (for example while the session
  /// starts, or when iOS limits the flash because the phone is warm), so it is re-checked on each
  /// bounded attempt. A stop request cancels the remaining attempts.
  private func activateTorch(_ device: AVCaptureDevice, level: Float, ticket: Int) throws {
    var lastProblem = "iOS did not report the flash as on."
    for attempt in 0..<SensorEngine.torchAttempts {
      if attempt > 0 {
        Thread.sleep(forTimeInterval: SensorEngine.torchRetryDelay)
      }
      try ensureCurrentRequest(ticket)
      guard session.isRunning else {
        throw SensorStartException("The rear camera stopped while the flash was turning on.")
      }
      guard device.isTorchAvailable else {
        lastProblem = "iOS reports the flash is temporarily unavailable (it can be limited when the phone is warm or another app is using it)."
        continue
      }
      do {
        try device.lockForConfiguration()
        defer { device.unlockForConfiguration() }
        try device.setTorchModeOn(level: level)
      } catch {
        lastProblem = "iOS refused to turn on the flash: \(error.localizedDescription)."
        continue
      }
      for _ in 0..<4 {
        try ensureCurrentRequest(ticket)
        if device.isTorchActive {
          return
        }
        Thread.sleep(forTimeInterval: 0.05)
      }
      lastProblem = "The flash was requested but iOS did not report it as active."
    }
    throw SensorStartException("The flash could not be turned on, so no pulse estimate is possible. \(lastProblem)")
  }

  private func startPpg(torchLevel: Float, ticket: Int) throws {
    guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
      throw SensorStartException("Rear camera not available on this device")
    }
    guard device.hasTorch, device.isTorchModeSupported(.on) else {
      throw SensorStartException("This iPhone's rear camera has no flash (torch).")
    }
    session.beginConfiguration()
    do {
      try configureInput(device, preset: .vga640x480)
      try addVideoOutput()
    } catch {
      session.commitConfiguration()
      throw error
    }
    session.commitConfiguration()
    try ensureCurrentRequest(ticket)
    session.startRunning()
    try ensureCurrentRequest(ticket)
    guard session.isRunning else {
      throw SensorStartException("The rear camera could not start.")
    }
    try activateTorch(device, level: torchLevel, ticket: ticket)
    try ensureCurrentRequest(ticket)
    if motionManager.isDeviceMotionAvailable {
      motionManager.deviceMotionUpdateInterval = 1.0 / 30.0
      motionManager.startDeviceMotionUpdates(to: motionQueue) { [weak self] motion, _ in
        guard let acceleration = motion?.userAcceleration else { return }
        self?.latestMotion = sqrt(acceleration.x * acceleration.x + acceleration.y * acceleration.y + acceleration.z * acceleration.z)
      }
    }
  }

  private func startFace() throws {
    guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front) else {
      throw SensorStartException("Front camera not available on this device")
    }
    session.beginConfiguration()
    do {
      try configureInput(device, preset: .vga640x480)
      try addVideoOutput()
    } catch {
      session.commitConfiguration()
      throw error
    }
    session.commitConfiguration()
    session.startRunning()
  }

  private func startDepth() throws {
    guard let device = AVCaptureDevice.default(.builtInTrueDepthCamera, for: .video, position: .front) else {
      throw SensorStartException("TrueDepth camera not available on this device")
    }
    session.beginConfiguration()
    do {
      try configureInput(device, preset: .vga640x480)
      let output = AVCaptureDepthDataOutput()
      output.isFilteringEnabled = true
      output.alwaysDiscardsLateDepthData = true
      guard session.canAddOutput(output) else {
        throw SensorStartException("Depth output could not be added")
      }
      session.addOutput(output)
      output.setDelegate(self, callbackQueue: captureQueue)
      if let connection = output.connection(with: .depthData) {
        connection.isEnabled = true
        setPortrait(connection)
      }
      let depthFormats = device.activeFormat.supportedDepthDataFormats.filter {
        CMFormatDescriptionGetMediaSubType($0.formatDescription) == kCVPixelFormatType_DepthFloat32
      }
      guard let best = depthFormats.max(by: {
        CMVideoFormatDescriptionGetDimensions($0.formatDescription).width < CMVideoFormatDescriptionGetDimensions($1.formatDescription).width
      }) else {
        throw SensorStartException("No 32-bit depth format available")
      }
      try device.lockForConfiguration()
      device.activeDepthDataFormat = best
      device.unlockForConfiguration()
    } catch {
      session.commitConfiguration()
      throw error
    }
    session.commitConfiguration()
    session.startRunning()
  }

  private func startAudio() throws {
    guard SensorEngine.microphonePermission() == "granted" else {
      throw SensorStartException("Microphone permission not granted")
    }
    let audioSession = AVAudioSession.sharedInstance()
    do {
      try audioSession.setCategory(.record, mode: .measurement, options: [])
      try audioSession.setActive(true)
    } catch {
      throw SensorStartException("Audio session unavailable: \(error.localizedDescription)")
    }
    let engine = AVAudioEngine()
    let input = engine.inputNode
    let format = input.outputFormat(forBus: 0)
    guard format.sampleRate > 0, format.channelCount > 0 else {
      try? audioSession.setActive(false)
      throw SensorStartException("No microphone input available")
    }
    input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
      self?.processAudio(buffer)
    }
    do {
      try engine.start()
    } catch {
      input.removeTap(onBus: 0)
      try? audioSession.setActive(false)
      throw SensorStartException("Microphone could not start: \(error.localizedDescription)")
    }
    audioEngine = engine
  }

  // MARK: Frame processing (on device only)

  private func regionStats(_ base: UnsafeMutablePointer<UInt8>, bytesPerRow: Int, width: Int, height: Int, rect: CGRect, step: Int) -> RegionStats {
    var stats = RegionStats()
    let x0 = max(0, Int(rect.minX * CGFloat(width)))
    let x1 = min(width, Int(rect.maxX * CGFloat(width)))
    let y0 = max(0, Int(rect.minY * CGFloat(height)))
    let y1 = min(height, Int(rect.maxY * CGFloat(height)))
    guard x1 > x0, y1 > y0 else { return stats }
    var y = y0
    while y < y1 {
      let row = base + y * bytesPerRow
      var x = x0
      while x < x1 {
        let pixel = row + x * 4
        let blue = Double(pixel[0])
        let green = Double(pixel[1])
        let red = Double(pixel[2])
        stats.r += red
        stats.g += green
        stats.b += blue
        stats.count += 1
        if red >= 250 { stats.saturated += 1 }
        if red < 30 { stats.dark += 1 }
        x += step
      }
      y += step
    }
    return stats
  }

  func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    guard let kind = activeKind, let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
    let t = CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sampleBuffer))
    guard t.isFinite else { return }
    frameIndex += 1
    if kind == "ppg" {
      processPpg(pixelBuffer, t: t)
    } else if kind == "face" {
      processFace(pixelBuffer, t: t)
    }
  }

  private func processPpg(_ pixelBuffer: CVPixelBuffer, t: Double) {
    if frameIndex % 15 == 0, let device = activeDevice, !device.isTorchActive {
      stopIfActive(["ppg"], reason: "torch_off")
      return
    }
    CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }
    guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else { return }
    let stats = regionStats(
      baseAddress.assumingMemoryBound(to: UInt8.self),
      bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuffer),
      width: CVPixelBufferGetWidth(pixelBuffer),
      height: CVPixelBufferGetHeight(pixelBuffer),
      rect: CGRect(x: 0.25, y: 0.25, width: 0.5, height: 0.5),
      step: 4
    )
    guard stats.count > 0 else { return }
    let n = Double(stats.count)
    emit?("onSample", [
      "kind": "ppg",
      "t": t,
      "r": stats.r / n,
      "g": stats.g / n,
      "b": stats.b / n,
      "saturatedFraction": Double(stats.saturated) / n,
      "darkFraction": Double(stats.dark) / n,
      "motion": latestMotion,
    ])
  }

  private func processFace(_ pixelBuffer: CVPixelBuffer, t: Double) {
    if frameIndex % 5 == 1 {
      let request = VNDetectFaceRectanglesRequest()
      let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up, options: [:])
      if (try? handler.perform([request])) != nil,
         let face = request.results?.max(by: { $0.boundingBox.width < $1.boundingBox.width }) {
        let box = face.boundingBox
        lastFaceRect = CGRect(x: box.minX, y: 1 - box.maxY, width: box.width, height: box.height)
        lastFaceSeen = t
      }
    }
    let faceFound = lastFaceRect != nil && (t - lastFaceSeen) < 1.0

    CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }
    guard let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer) else { return }
    let base = baseAddress.assumingMemoryBound(to: UInt8.self)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
    let width = CVPixelBufferGetWidth(pixelBuffer)
    let height = CVPixelBufferGetHeight(pixelBuffer)
    let whole = regionStats(base, bytesPerRow: bytesPerRow, width: width, height: height, rect: CGRect(x: 0, y: 0, width: 1, height: 1), step: 16)
    let luminance = whole.count > 0 ? (0.299 * whole.r + 0.587 * whole.g + 0.114 * whole.b) / Double(whole.count) : 0

    var roi = RegionStats()
    var faceRect = CGRect.zero
    if faceFound, let rect = lastFaceRect {
      faceRect = rect
      let forehead = CGRect(x: rect.minX + rect.width * 0.3, y: rect.minY + rect.height * 0.08, width: rect.width * 0.4, height: rect.height * 0.17)
      let leftCheek = CGRect(x: rect.minX + rect.width * 0.15, y: rect.minY + rect.height * 0.5, width: rect.width * 0.2, height: rect.height * 0.2)
      let rightCheek = CGRect(x: rect.minX + rect.width * 0.65, y: rect.minY + rect.height * 0.5, width: rect.width * 0.2, height: rect.height * 0.2)
      for region in [forehead, leftCheek, rightCheek] {
        roi.add(regionStats(base, bytesPerRow: bytesPerRow, width: width, height: height, rect: region, step: 2))
      }
    }
    let n = Double(max(roi.count, 1))
    emit?("onSample", [
      "kind": "face",
      "t": t,
      "faceFound": faceFound && roi.count > 0,
      "r": roi.r / n,
      "g": roi.g / n,
      "b": roi.b / n,
      "luminance": luminance,
      "faceX": Double(faceRect.midX),
      "faceY": Double(faceRect.midY),
      "faceW": Double(faceRect.width),
    ])
  }

  func depthDataOutput(_ output: AVCaptureDepthDataOutput, didOutput depthData: AVDepthData, timestamp: CMTime, connection: AVCaptureConnection) {
    guard activeKind == "depth" else { return }
    let t = CMTimeGetSeconds(timestamp)
    guard t.isFinite, t - lastDepthEmit >= 1.0 / 15.0 else { return }
    lastDepthEmit = t
    let converted = depthData.depthDataType == kCVPixelFormatType_DepthFloat32
      ? depthData
      : depthData.converting(toDepthDataType: kCVPixelFormatType_DepthFloat32)
    let map = converted.depthDataMap
    CVPixelBufferLockBaseAddress(map, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(map, .readOnly) }
    guard let baseAddress = CVPixelBufferGetBaseAddress(map) else { return }
    let width = CVPixelBufferGetWidth(map)
    let height = CVPixelBufferGetHeight(map)
    let bytesPerRow = CVPixelBufferGetBytesPerRow(map)
    let roi = chestRoi
    let x0 = max(0, Int(roi.minX * CGFloat(width)))
    let x1 = min(width, Int(roi.maxX * CGFloat(width)))
    let y0 = max(0, Int(roi.minY * CGFloat(height)))
    let y1 = min(height, Int(roi.maxY * CGFloat(height)))
    guard x1 > x0, y1 > y0 else { return }
    var sum = 0.0
    var valid = 0
    var total = 0
    for y in stride(from: y0, to: y1, by: 2) {
      let row = (baseAddress + y * bytesPerRow).assumingMemoryBound(to: Float32.self)
      for x in stride(from: x0, to: x1, by: 2) {
        let depth = row[x]
        total += 1
        if depth.isFinite && depth > 0.1 && depth < 3.0 {
          sum += Double(depth)
          valid += 1
        }
      }
    }
    emit?("onSample", [
      "kind": "depth",
      "t": t,
      "meanDepth": valid > 0 ? sum / Double(valid) : 0,
      "validFraction": total > 0 ? Double(valid) / Double(total) : 0,
    ])
  }

  private func processAudio(_ buffer: AVAudioPCMBuffer) {
    guard let samples = buffer.floatChannelData?[0] else { return }
    let count = Int(buffer.frameLength)
    guard count > 0 else { return }
    let now = CACurrentMediaTime()
    guard now - lastAudioEmit >= 0.05 else { return }
    lastAudioEmit = now
    var sumSquares: Float = 0
    var peak: Float = 0
    for i in 0..<count {
      let sample = samples[i]
      sumSquares += sample * sample
      peak = max(peak, abs(sample))
    }
    let rms = Double(sqrt(sumSquares / Float(count)))
    let dbfs = rms > 0 ? max(-120, 20 * log10(rms)) : -120
    emit?("onSample", ["kind": "audio", "t": now, "rms": rms, "peak": Double(peak), "dbfs": dbfs])
  }
}
