import { requireNativeViewManager, requireOptionalNativeModule } from "expo-modules-core";
import type { ComponentType } from "react";
import type { ViewProps } from "react-native";

export type SensorKind = "ppg" | "face" | "audio" | "depth";
export type PermissionState = "granted" | "denied" | "undetermined";

export type Availability = {
  nativeModule: boolean;
  isSimulator: boolean;
  backCamera: boolean;
  torch: boolean;
  frontCamera: boolean;
  trueDepth: boolean;
  microphone: boolean;
  deviceMotion: boolean;
  cameraPermission: PermissionState;
  microphonePermission: PermissionState;
};

export type SensorSample =
  | { kind: "ppg"; t: number; r: number; g: number; b: number; saturatedFraction: number; darkFraction: number; motion: number }
  | {
      kind: "face";
      t: number;
      faceFound: boolean;
      r: number;
      g: number;
      b: number;
      luminance: number;
      faceX: number;
      faceY: number;
      faceW: number;
    }
  | { kind: "depth"; t: number; meanDepth: number; validFraction: number }
  | { kind: "audio"; t: number; rms: number; peak: number; dbfs: number };

export type SensorStatusEvent = { state: "running" | "stopped"; kind: SensorKind; reason?: string };

type Subscription = { remove(): void };

type NativeModule = {
  getAvailability(): Availability;
  requestCameraPermission(): Promise<boolean>;
  requestMicrophonePermission(): Promise<boolean>;
  start(kind: SensorKind, options: { maxSeconds: number; torchLevel?: number }): Promise<void>;
  stop(): void;
  setChestRoi(x: number, y: number, width: number, height: number): void;
  addListener(event: "onSample", listener: (sample: SensorSample) => void): Subscription;
  addListener(event: "onStatus", listener: (status: SensorStatusEvent) => void): Subscription;
};

const native = requireOptionalNativeModule<NativeModule>("NightSignalSensors");

export const NATIVE_UNAVAILABLE: Availability = {
  nativeModule: false,
  isSimulator: false,
  backCamera: false,
  torch: false,
  frontCamera: false,
  trueDepth: false,
  microphone: false,
  deviceMotion: false,
  cameraPermission: "undetermined",
  microphonePermission: "undetermined",
};

export const Sensors = {
  isNativeAvailable: native !== null,
  getAvailability(): Availability {
    return native ? native.getAvailability() : NATIVE_UNAVAILABLE;
  },
  async requestCameraPermission(): Promise<boolean> {
    return native ? native.requestCameraPermission() : false;
  },
  async requestMicrophonePermission(): Promise<boolean> {
    return native ? native.requestMicrophonePermission() : false;
  },
  async start(kind: SensorKind, options: { maxSeconds: number; torchLevel?: number }): Promise<void> {
    if (!native) throw new Error("Native sensor module is not included in this build");
    await native.start(kind, options);
  },
  stop(): void {
    native?.stop();
  },
  setChestRoi(x: number, y: number, width: number, height: number): void {
    native?.setChestRoi(x, y, width, height);
  },
  onSample(listener: (sample: SensorSample) => void): Subscription {
    return native ? native.addListener("onSample", listener) : { remove() {} };
  },
  onStatus(listener: (status: SensorStatusEvent) => void): Subscription {
    return native ? native.addListener("onStatus", listener) : { remove() {} };
  },
};

let previewView: ComponentType<ViewProps & { cornerRadius?: number }> | null = null;
export function getPreviewView(): ComponentType<ViewProps & { cornerRadius?: number }> | null {
  if (!native) return null;
  previewView ??= requireNativeViewManager<ViewProps & { cornerRadius?: number }>("NightSignalSensors");
  return previewView;
}
