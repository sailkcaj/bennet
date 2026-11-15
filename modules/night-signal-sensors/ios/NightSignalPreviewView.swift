import AVFoundation
import ExpoModulesCore
import UIKit

final class NightSignalPreviewView: ExpoView {
  private let previewLayer = AVCaptureVideoPreviewLayer()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .black
    previewLayer.session = SensorEngine.shared.session
    previewLayer.videoGravity = .resizeAspectFill
    layer.addSublayer(previewLayer)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    previewLayer.frame = bounds
  }
}
