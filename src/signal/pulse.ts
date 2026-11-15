import { estimatePeriodic, mean, movingAverage, resampleUniform, std, type PeriodicOptions } from "./dsp";
import type { DepthFrame, Estimate, FaceFrame, PpgFrame } from "./types";

const PULSE_OPTIONS: PeriodicOptions = {
  rateHz: 30,
  minHz: 0.7,
  maxHz: 3.5,
  minSeconds: 12,
  minEffectiveRateHz: 15,
  maxGapSeconds: 0.5,
  minConcentration: 0.35,
  minAutocorrelation: 0.35,
  maxHalfDisagreementHz: 0.15,
  minRelativeVariation: 0.0005,
};

export const FINGERTIP_WINDOW_SECONDS = 20;
export const FACE_WINDOW_SECONDS = 20;
export const BREATHING_WINDOW_SECONDS = 20;

function windowed<T extends { t: number }>(frames: T[], seconds: number): T[] {
  if (frames.length === 0) return frames;
  const end = frames[frames.length - 1].t;
  return frames.filter((frame) => frame.t >= end - seconds);
}

function suppressed(reasons: string[], seconds: number): Estimate {
  return { status: "poor_signal", value: null, quality: 0, reasons, seconds };
}

function toEstimate(result: ReturnType<typeof estimatePeriodic>, perMinute: (hz: number) => number): Estimate {
  const value = result.status === "usable" && result.freqHz !== null ? Math.round(perMinute(result.freqHz)) : null;
  return {
    status: value !== null && Number.isFinite(value) ? "usable" : result.status === "usable" ? "poor_signal" : result.status,
    value: value !== null && Number.isFinite(value) ? value : null,
    quality: Number.isFinite(result.quality) ? result.quality : 0,
    reasons: result.reasons,
    seconds: result.seconds,
  };
}

function finite(...values: number[]): boolean {
  return values.every(Number.isFinite);
}

export function estimateFingertipPulse(allFrames: PpgFrame[]): Estimate {
  const frames = windowed(
    allFrames.filter((f) => finite(f.t, f.r, f.g, f.b, f.saturatedFraction, f.darkFraction, f.motion)),
    FINGERTIP_WINDOW_SECONDS,
  );
  const seconds = frames.length > 1 ? frames[frames.length - 1].t - frames[0].t : 0;
  if (frames.length === 0) return { status: "acquiring", value: null, quality: 0, reasons: ["insufficient_samples"], seconds };

  const reasons: string[] = [];
  const fingerFrames = frames.filter((f) => f.r >= 60 && f.r > f.g * 1.4 && f.r > f.b * 1.4 && f.darkFraction < 0.5);
  if (fingerFrames.length / frames.length < 0.9) reasons.push("no_finger");
  const saturated = frames.filter((f) => f.saturatedFraction > 0.25).length / frames.length;
  if (saturated > 0.2) reasons.push("saturated");
  const moving = frames.filter((f) => f.motion > 0.08).length / frames.length;
  if (moving > 0.1) reasons.push("movement");
  if (reasons.length > 0) return suppressed(reasons, seconds);

  return toEstimate(estimatePeriodic(frames.map((f) => ({ t: f.t, v: f.r })), PULSE_OPTIONS), (hz) => hz * 60);
}

export function posSignal(frames: { t: number; r: number; g: number; b: number }[], rateHz: number): number[] {
  const r = resampleUniform(frames.map((f) => ({ t: f.t, v: f.r })), rateHz);
  const g = resampleUniform(frames.map((f) => ({ t: f.t, v: f.g })), rateHz);
  const b = resampleUniform(frames.map((f) => ({ t: f.t, v: f.b })), rateHz);
  const window = Math.round(rateHz * 1.6);
  const rm = movingAverage(r, window);
  const gm = movingAverage(g, window);
  const bm = movingAverage(b, window);
  const s1: number[] = [];
  const s2: number[] = [];
  for (let i = 0; i < r.length; i++) {
    const rn = rm[i] > 0 ? r[i] / rm[i] : 1;
    const gn = gm[i] > 0 ? g[i] / gm[i] : 1;
    const bn = bm[i] > 0 ? b[i] / bm[i] : 1;
    s1.push(gn - bn);
    s2.push(gn + bn - 2 * rn);
  }
  const alpha = std(s2) > 0 ? std(s1) / std(s2) : 0;
  return s1.map((value, i) => value + alpha * s2[i]);
}

const FACE_OPTIONS: PeriodicOptions = {
  ...PULSE_OPTIONS,
  maxHz: 3.0,
  minSeconds: 15,
  minRelativeVariation: 0,
};

export function estimateFacePulse(allFrames: FaceFrame[]): Estimate {
  const frames = windowed(
    allFrames.filter((f) => finite(f.t, f.r, f.g, f.b, f.luminance, f.faceX, f.faceY, f.faceW)),
    FACE_WINDOW_SECONDS,
  );
  const seconds = frames.length > 1 ? frames[frames.length - 1].t - frames[0].t : 0;
  if (seconds < FACE_OPTIONS.minSeconds) {
    return { status: "acquiring", value: null, quality: 0, reasons: ["insufficient_samples"], seconds };
  }
  const reasons: string[] = [];
  const withFace = frames.filter((f) => f.faceFound);
  if (withFace.length / frames.length < 0.9) reasons.push("no_face");
  if (mean(frames.map((f) => f.luminance)) < 40) reasons.push("too_dark");
  if (withFace.length > 1) {
    const positionJitter = Math.max(std(withFace.map((f) => f.faceX)), std(withFace.map((f) => f.faceY)));
    const sizeChange = std(withFace.map((f) => f.faceW)) / Math.max(1e-6, mean(withFace.map((f) => f.faceW)));
    if (positionJitter > 0.03 || sizeChange > 0.08) reasons.push("movement");
  }
  if (reasons.length > 0) return suppressed(reasons, seconds);

  const pulse = posSignal(withFace, FACE_OPTIONS.rateHz);
  const start = withFace[0].t;
  const series = pulse.map((v, i) => ({ t: start + i / FACE_OPTIONS.rateHz, v }));
  const effectiveRateOk = withFace.length / seconds >= FACE_OPTIONS.minEffectiveRateHz;
  if (!effectiveRateOk) return suppressed(["low_sample_rate"], seconds);
  return toEstimate(estimatePeriodic(series, FACE_OPTIONS), (hz) => hz * 60);
}

const BREATHING_OPTIONS: PeriodicOptions = {
  rateHz: 10,
  minHz: 0.1,
  maxHz: 0.7,
  minSeconds: BREATHING_WINDOW_SECONDS - 2,
  minEffectiveRateHz: 5,
  maxGapSeconds: 1,
  minConcentration: 0.4,
  minAutocorrelation: 0.3,
  maxHalfDisagreementHz: 0.08,
  minRelativeVariation: 0.0002,
};

export function estimateBreathingMovement(allFrames: DepthFrame[]): Estimate {
  const frames = windowed(allFrames.filter((f) => finite(f.t, f.meanDepth, f.validFraction)), BREATHING_WINDOW_SECONDS);
  const seconds = frames.length > 1 ? frames[frames.length - 1].t - frames[0].t : 0;
  if (seconds < BREATHING_OPTIONS.minSeconds) {
    return { status: "acquiring", value: null, quality: 0, reasons: ["insufficient_samples"], seconds };
  }
  const reasons: string[] = [];
  if (frames.filter((f) => f.validFraction >= 0.6).length / frames.length < 0.9) reasons.push("depth_invalid");
  const depth = mean(frames.map((f) => f.meanDepth));
  if (depth < 0.2 || depth > 1.5) reasons.push("out_of_range");
  if (std(frames.map((f) => f.meanDepth)) > 0.05) reasons.push("large_movement");
  if (reasons.length > 0) return suppressed(reasons, seconds);
  return toEstimate(estimatePeriodic(frames.map((f) => ({ t: f.t, v: f.meanDepth })), BREATHING_OPTIONS), (hz) => hz * 60);
}
