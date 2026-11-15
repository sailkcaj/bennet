import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { Sensors, type Availability, type SensorKind, type SensorSample } from "../../modules/night-signal-sensors";
import { detrend } from "../signal/dsp";
import { FINGERTIP_TORCH_LEVEL, SESSION_LIMITS } from "./limits";
import { createStartGate, settleStart } from "./startGate";
import { estimateBreathingMovement, estimateFacePulse, estimateFingertipPulse } from "../signal/pulse";
import type { DepthFrame, Estimate, FaceFrame, PpgFrame } from "../signal/types";

export type SessionStatus =
  | "idle"
  | "checking"
  | "permission_denied"
  | "unavailable"
  | "acquiring"
  | "usable"
  | "poor_signal"
  | "running"
  | "interrupted"
  | "session_limit"
  | "stopped";

export type SensorSessionState = {
  status: SessionStatus;
  detail: string | null;
  estimate: Estimate | null;
  trace: number[];
  level: number | null;
  elapsed: number;
};

export { SESSION_LIMITS } from "./limits";

const BUFFER_SECONDS: Record<SensorKind, number> = { ppg: 25, face: 25, audio: 10, depth: 25 };

export function unavailableReason(kind: SensorKind, a: Availability): string | null {
  if (!a.nativeModule) return "Native sensor module is not part of this build.";
  const simulator = a.isSimulator ? " (iOS Simulator has no camera hardware)" : "";
  switch (kind) {
    case "ppg":
      if (!a.backCamera) return "Rear camera not available" + simulator;
      if (!a.torch) return "Rear flash (torch) not available" + simulator;
      return null;
    case "face":
      return a.frontCamera ? null : "Front camera not available" + simulator;
    case "depth":
      return a.trueDepth ? null : a.isSimulator ? "TrueDepth is unsupported in the iOS Simulator" : "This iPhone has no TrueDepth depth stream";
    case "audio":
      return a.microphone ? null : "No microphone input available" + (a.isSimulator ? " in this simulator" : "");
  }
}

function permissionFor(kind: SensorKind, a: Availability) {
  return kind === "audio" ? a.microphonePermission : a.cameraPermission;
}

const STOP_REASON_TEXT: Record<string, string> = {
  app_inactive: "Monitoring paused: the app left the foreground. Restart when ready.",
  app_backgrounded: "Monitoring paused: the app was backgrounded. Restart when ready.",
  capture_interrupted: "Monitoring paused: another app or a call took the camera.",
  capture_error: "Camera stopped unexpectedly. Restart when ready.",
  audio_interrupted: "Monitoring paused: audio was interrupted (call, alarm or another app).",
  session_limit: "Session limit reached — stopped automatically.",
  torch_off: "The flash turned off (iOS can limit it when the phone is warm), so the measurement stopped. No estimate is shown without the flash.",
};

export function useSensorSession(kind: SensorKind) {
  const [state, setState] = useState<SensorSessionState>({
    status: "idle",
    detail: null,
    estimate: null,
    trace: [],
    level: null,
    elapsed: 0,
  });
  const samples = useRef<SensorSample[]>([]);
  const startedAt = useRef<number>(0);
  const running = useRef(false);
  const [gate] = useState(createStartGate);
  const lastEstimate = useRef<{ at: number; estimate: Estimate | null }>({ at: 0, estimate: null });
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);
  const subscriptions = useRef<{ remove(): void }[]>([]);

  const teardown = useCallback(() => {
    timers.current.forEach(clearInterval);
    timers.current = [];
    subscriptions.current.forEach((s) => s.remove());
    subscriptions.current = [];
    running.current = false;
  }, []);

  const finish = useCallback(
    (status: SessionStatus, detail: string | null) => {
      gate.invalidate();
      const wasRunning = running.current;
      teardown();
      if (wasRunning) Sensors.stop();
      setState((previous) => ({ ...previous, status, detail, estimate: null }));
    },
    [gate, teardown],
  );

  const stop = useCallback(() => finish("stopped", "Stopped. Camera, torch and microphone are off."), [finish]);

  const compute = useCallback(() => {
    const now = Date.now();
    const all = samples.current;
    const latest = all.length ? all[all.length - 1].t : 0;
    const buffered = all.filter((s) => s.t >= latest - BUFFER_SECONDS[kind]);
    samples.current = buffered;
    const refreshEstimate = now - lastEstimate.current.at >= 1000;
    let estimate: Estimate | null = lastEstimate.current.estimate;
    let level: number | null = null;
    let raw: number[] = [];
    if (kind === "ppg") {
      const frames = buffered as PpgFrame[];
      if (refreshEstimate) estimate = estimateFingertipPulse(frames);
      raw = frames.slice(-180).map((f) => -f.r);
    } else if (kind === "face") {
      const frames = buffered as FaceFrame[];
      if (refreshEstimate) estimate = estimateFacePulse(frames);
      raw = frames.slice(-180).map((f) => (f.faceFound ? f.g : Number.NaN));
    } else if (kind === "depth") {
      const frames = buffered as DepthFrame[];
      if (refreshEstimate) estimate = estimateBreathingMovement(frames);
      raw = frames.slice(-450).map((f) => (f.validFraction > 0.3 ? -f.meanDepth : Number.NaN));
    } else {
      const frames = buffered as Extract<SensorSample, { kind: "audio" }>[];
      raw = frames.slice(-200).map((f) => f.dbfs);
      level = frames.length ? frames[frames.length - 1].dbfs : null;
    }
    if (refreshEstimate) lastEstimate.current = { at: now, estimate };
    const finiteRaw = raw.filter(Number.isFinite);
    const trace = kind === "audio" ? finiteRaw : finiteRaw.length > 10 ? detrend(finiteRaw, kind === "depth" ? 75 : 30) : finiteRaw;
    const status: SessionStatus = kind === "audio" ? "running" : estimate ? estimate.status : "acquiring";
    setState({ status, detail: null, estimate, trace, level, elapsed: (now - startedAt.current) / 1000 });
  }, [kind]);

  const start = useCallback(async () => {
    finish("checking", null);
    const attempt = gate.begin();
    let availability = Sensors.getAvailability();
    const missing = unavailableReason(kind, availability);
    if (missing) {
      setState((p) => ({ ...p, status: "unavailable", detail: missing }));
      return;
    }
    let permission = permissionFor(kind, availability);
    const device = kind === "audio" ? "Microphone" : "Camera";
    if (permission === "undetermined") {
      if (kind === "audio") await Sensors.requestMicrophonePermission();
      else await Sensors.requestCameraPermission();
      if (!attempt.isCurrent()) return;
      availability = Sensors.getAvailability();
      permission = permissionFor(kind, availability);
    }
    if (permission === "denied") {
      setState((p) => ({ ...p, status: "permission_denied", detail: `${device} access was denied. You can allow it in Settings, then try again.` }));
      return;
    }
    if (permission !== "granted") {
      setState((p) => ({
        ...p,
        status: "unavailable",
        detail: `${device} permission could not be confirmed by iOS${availability.isSimulator ? " in this simulator" : ""}. Nothing was captured.`,
      }));
      return;
    }
    if (AppState.currentState !== "active") {
      setState((p) => ({ ...p, status: "interrupted", detail: STOP_REASON_TEXT.app_inactive }));
      return;
    }
    samples.current = [];
    lastEstimate.current = { at: 0, estimate: null };
    subscriptions.current.push(
      Sensors.onSample((sample) => {
        if (sample.kind === kind) samples.current.push(sample);
      }),
      Sensors.onStatus((event) => {
        if (event.state !== "stopped" || !running.current) return;
        const reason = event.reason ?? "";
        if (reason === "switching_mode" || reason === "user_stopped") return;
        finish(reason === "session_limit" ? "session_limit" : "interrupted", STOP_REASON_TEXT[reason] ?? `Stopped: ${reason}`);
      }),
    );
    running.current = true;
    const outcome = await settleStart(
      attempt,
      Sensors.start(kind, { maxSeconds: SESSION_LIMITS[kind], torchLevel: FINGERTIP_TORCH_LEVEL }),
      () => Sensors.stop(),
    );
    if (outcome.kind === "stale") return;
    if (outcome.kind === "failed") {
      teardown();
      const error = outcome.error;
      const message = (error instanceof Error ? error.message : String(error)).replace(/^[\s\S]*Caused by:\s*/, "");
      setState((p) => ({ ...p, status: /permission/i.test(message) ? "permission_denied" : "unavailable", detail: message }));
      return;
    }
    startedAt.current = Date.now();
    setState({ status: kind === "audio" ? "running" : "acquiring", detail: null, estimate: null, trace: [], level: null, elapsed: 0 });
    timers.current.push(setInterval(compute, kind === "audio" ? 100 : 250));
  }, [compute, finish, gate, kind, teardown]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active" && running.current) finish("interrupted", STOP_REASON_TEXT.app_inactive);
    });
    return () => {
      subscription.remove();
      gate.invalidate();
      if (running.current) Sensors.stop();
      teardown();
    };
  }, [finish, gate, teardown]);

  return { state, start, stop, isRunning: () => running.current };
}
