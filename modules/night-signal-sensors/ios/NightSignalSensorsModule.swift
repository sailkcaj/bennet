import AVFoundation
import ExpoModulesCore

public class NightSignalSensorsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NightSignalSensors")

    Events("onSample", "onStatus")

    OnCreate {
      SensorEngine.shared.emit = { [weak self] name, body in
        self?.sendEvent(name, body)
      }
    }

    OnDestroy {
      SensorEngine.shared.stop(reason: "module_destroyed")
    }

    OnAppEntersBackground {
      SensorEngine.shared.stop(reason: "app_backgrounded")
    }

    Function("getAvailability") { () -> [String: Any] in
      return SensorEngine.shared.availability()
    }

    AsyncFunction("requestCameraPermission") { (promise: Promise) in
      AVCaptureDevice.requestAccess(for: .video) { granted in
        promise.resolve(granted)
      }
    }

    AsyncFunction("requestMicrophonePermission") { (promise: Promise) in
      SensorEngine.requestMicrophonePermission { granted in
        promise.resolve(granted)
      }
    }

    AsyncFunction("start") { (kind: String, options: [String: Any]) in
      try SensorEngine.shared.start(kind: kind, options: options)
    }

    Function("stop") {
      SensorEngine.shared.stop(reason: "user_stopped")
    }

    Function("setChestRoi") { (x: Double, y: Double, width: Double, height: Double) in
      SensorEngine.shared.setChestRoi(x: x, y: y, width: width, height: height)
    }

    View(NightSignalPreviewView.self) {
      Prop("cornerRadius") { (view: NightSignalPreviewView, radius: Double) in
        view.layer.cornerRadius = CGFloat(radius)
      }
    }
  }
}
