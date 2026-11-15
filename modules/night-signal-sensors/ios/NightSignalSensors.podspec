Pod::Spec.new do |s|
  s.name           = 'NightSignalSensors'
  s.version        = '0.1.0'
  s.summary        = 'On-device experimental camera, microphone and depth signal capture for NightSignal'
  s.description    = s.summary
  s.license        = 'MIT'
  s.author         = 'NightSignal'
  s.homepage       = 'https://example.invalid/nightsignal'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'Vision', 'CoreMotion', 'CoreMedia', 'CoreVideo'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
