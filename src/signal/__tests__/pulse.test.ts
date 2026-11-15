import { describe, expect, it } from "vitest";
import { BREATHING_WINDOW_SECONDS, estimateBreathingMovement, estimateFacePulse, estimateFingertipPulse } from "../pulse";
import type { DepthFrame, FaceFrame, PpgFrame } from "../types";
import { frameTimes, gaussian, seededRandom } from "./syntheticFixtures";

function syntheticPpg(opts: {
  seconds: number;
  hz: number | null;
  amplitude?: number;
  noise?: number;
  seed?: number;
  overrides?: Partial<PpgFrame>;
}): PpgFrame[] {
  const random = seededRandom(opts.seed ?? 1);
  const noise = gaussian(random);
  return frameTimes(opts.seconds, 30, random).map((t) => {
    const pulse = opts.hz === null ? 0 : (opts.amplitude ?? 1.5) * Math.sin(2 * Math.PI * opts.hz * t);
    return {
      t,
      r: 180 + 3 * Math.sin(2 * Math.PI * 0.05 * t) + pulse + (opts.noise ?? 0.3) * noise(),
      g: 40,
      b: 30,
      saturatedFraction: 0.02,
      darkFraction: 0,
      motion: 0.01,
      ...opts.overrides,
    };
  });
}

describe("fingertip PPG estimator (synthetic signals)", () => {
  it("recovers a known 72 bpm rhythm with mild noise", () => {
    const estimate = estimateFingertipPulse(syntheticPpg({ seconds: 20, hz: 1.2 }));
    expect(estimate.status).toBe("usable");
    expect(estimate.value).not.toBeNull();
    expect(Math.abs((estimate.value ?? 0) - 72)).toBeLessThanOrEqual(3);
  });

  it("recovers a known 108 bpm rhythm", () => {
    const estimate = estimateFingertipPulse(syntheticPpg({ seconds: 20, hz: 1.8, seed: 7 }));
    expect(estimate.status).toBe("usable");
    expect(Math.abs((estimate.value ?? 0) - 108)).toBeLessThanOrEqual(3);
  });

  it("suppresses a number for pure noise", () => {
    const estimate = estimateFingertipPulse(syntheticPpg({ seconds: 20, hz: null, noise: 1.5, seed: 3 }));
    expect(estimate.value).toBeNull();
    expect(estimate.status).toBe("poor_signal");
  });

  it("suppresses a number when the rhythm is buried in heavy noise", () => {
    const estimate = estimateFingertipPulse(syntheticPpg({ seconds: 20, hz: 1.2, amplitude: 0.2, noise: 3, seed: 11 }));
    expect(estimate.value).toBeNull();
  });

  it("reports acquiring with insufficient samples", () => {
    const estimate = estimateFingertipPulse(syntheticPpg({ seconds: 5, hz: 1.2 }));
    expect(estimate.status).toBe("acquiring");
    expect(estimate.value).toBeNull();
  });

  it("suppresses when no finger covers the lens", () => {
    const estimate = estimateFingertipPulse(syntheticPpg({ seconds: 20, hz: 1.2, overrides: { g: 150, b: 140 } }));
    expect(estimate.value).toBeNull();
    expect(estimate.reasons).toContain("no_finger");
  });

  it("suppresses when the image is saturated", () => {
    const estimate = estimateFingertipPulse(syntheticPpg({ seconds: 20, hz: 1.2, overrides: { saturatedFraction: 0.6 } }));
    expect(estimate.value).toBeNull();
    expect(estimate.reasons).toContain("saturated");
  });

  it("suppresses during movement", () => {
    const estimate = estimateFingertipPulse(syntheticPpg({ seconds: 20, hz: 1.2, overrides: { motion: 0.3 } }));
    expect(estimate.value).toBeNull();
    expect(estimate.reasons).toContain("movement");
  });

  it("suppresses a flat (absent) signal", () => {
    const frames = syntheticPpg({ seconds: 20, hz: null, noise: 0 }).map((f) => ({ ...f, r: 180 }));
    const estimate = estimateFingertipPulse(frames);
    expect(estimate.value).toBeNull();
    expect(estimate.reasons).toContain("flat_signal");
  });

  it("never returns NaN when frames contain NaN values", () => {
    const frames = syntheticPpg({ seconds: 20, hz: 1.2 }).map((f, i) => (i % 17 === 0 ? { ...f, r: Number.NaN } : f));
    const estimate = estimateFingertipPulse(frames);
    expect(Number.isNaN(estimate.quality)).toBe(false);
    if (estimate.value !== null) expect(Number.isFinite(estimate.value)).toBe(true);
  });

  it("suppresses when frames have a long gap", () => {
    const frames = syntheticPpg({ seconds: 20, hz: 1.2 }).filter((f) => f.t < 105 || f.t > 107);
    expect(estimateFingertipPulse(frames).value).toBeNull();
  });
});

function syntheticFace(opts: { seconds: number; hz: number; seed?: number; overrides?: Partial<FaceFrame> }): FaceFrame[] {
  const random = seededRandom(opts.seed ?? 5);
  const noise = gaussian(random);
  return frameTimes(opts.seconds, 30, random).map((t) => {
    const pulse = Math.sin(2 * Math.PI * opts.hz * t);
    const light = 1 + 0.01 * Math.sin(2 * Math.PI * 0.1 * t);
    return {
      t,
      faceFound: true,
      r: (150 + 0.15 * pulse + 0.1 * noise()) * light,
      g: (110 + 0.35 * pulse + 0.1 * noise()) * light,
      b: (90 + 0.1 * pulse + 0.1 * noise()) * light,
      luminance: 120,
      faceX: 0.5,
      faceY: 0.4,
      faceW: 0.4,
      ...opts.overrides,
    };
  });
}

describe("face rPPG estimator (synthetic RGB traces)", () => {
  it("recovers a known 66 bpm rhythm via POS projection", () => {
    const estimate = estimateFacePulse(syntheticFace({ seconds: 20, hz: 1.1 }));
    expect(estimate.status).toBe("usable");
    expect(Math.abs((estimate.value ?? 0) - 66)).toBeLessThanOrEqual(3);
  });

  it("suppresses without a face", () => {
    const estimate = estimateFacePulse(syntheticFace({ seconds: 20, hz: 1.1, overrides: { faceFound: false } }));
    expect(estimate.value).toBeNull();
    expect(estimate.reasons).toContain("no_face");
  });

  it("suppresses in low light", () => {
    const estimate = estimateFacePulse(syntheticFace({ seconds: 20, hz: 1.1, overrides: { luminance: 12 } }));
    expect(estimate.value).toBeNull();
    expect(estimate.reasons).toContain("too_dark");
  });
});

function syntheticDepth(opts: { seconds: number; hz: number | null; seed?: number; overrides?: Partial<DepthFrame> }): DepthFrame[] {
  const random = seededRandom(opts.seed ?? 9);
  const noise = gaussian(random);
  return frameTimes(opts.seconds, 15, random).map((t) => ({
    t,
    meanDepth: 0.6 + (opts.hz === null ? 0 : 0.003 * Math.sin(2 * Math.PI * opts.hz * t)) + 0.0004 * noise(),
    validFraction: 0.95,
    ...opts.overrides,
  }));
}

describe("depth breathing-movement estimator (synthetic depth)", () => {
  it("recovers a known 15 per minute movement cadence", () => {
    const estimate = estimateBreathingMovement(syntheticDepth({ seconds: 60, hz: 0.25 }));
    expect(estimate.status).toBe("usable");
    expect(Math.abs((estimate.value ?? 0) - 15)).toBeLessThanOrEqual(1);
  });

  it("suppresses without periodic movement", () => {
    expect(estimateBreathingMovement(syntheticDepth({ seconds: 60, hz: null })).value).toBeNull();
  });

  it("suppresses when depth is invalid", () => {
    const estimate = estimateBreathingMovement(syntheticDepth({ seconds: 60, hz: 0.25, overrides: { validFraction: 0.1 } }));
    expect(estimate.value).toBeNull();
    expect(estimate.reasons).toContain("depth_invalid");
  });

  it("recovers slow and fast movement cadences inside a 30 second session", () => {
    for (const [hz, perMinute] of [
      [0.2, 12],
      [0.33, 20],
    ]) {
      const estimate = estimateBreathingMovement(syntheticDepth({ seconds: 24, hz, seed: 4 }));
      expect(estimate.status).toBe("usable");
      expect(Math.abs((estimate.value ?? 0) - perMinute)).toBeLessThanOrEqual(1);
    }
  });

  it("keeps acquiring until the short window is full", () => {
    const estimate = estimateBreathingMovement(syntheticDepth({ seconds: BREATHING_WINDOW_SECONDS - 4, hz: 0.25 }));
    expect(estimate.status).toBe("acquiring");
    expect(estimate.value).toBeNull();
  });

  it("rejects a flat depth trace inside the short window", () => {
    const estimate = estimateBreathingMovement(syntheticDepth({ seconds: 24, hz: null, seed: 5 }));
    expect(estimate.value).toBeNull();
    expect(estimate.status).not.toBe("usable");
  });

  it("rejects large body movement inside the short window", () => {
    const base = syntheticDepth({ seconds: 24, hz: 0.25, seed: 6 });
    const midpoint = (base[0].t + base[base.length - 1].t) / 2;
    const frames = base.map((f) => ({ ...f, meanDepth: f.meanDepth + (f.t > midpoint ? 0.15 : 0) }));
    const estimate = estimateBreathingMovement(frames);
    expect(estimate.value).toBeNull();
    expect(estimate.reasons).toContain("large_movement");
  });
});
