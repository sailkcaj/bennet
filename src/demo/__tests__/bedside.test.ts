import { describe, expect, it } from "vitest";
import { BREATHING_READY_SECONDS, DEMO_SECONDS, demoReadings, demoSummary, PULSE_READY_SECONDS, waveWindow, breathingWave, pulseWave } from "../bedside";

describe("bedside demo data", () => {
  it("lasts 30 seconds", () => {
    expect(DEMO_SECONDS).toBe(30);
  });

  it("shows no simulated number while the demo is settling", () => {
    expect(demoReadings("propped", BREATHING_READY_SECONDS - 0.1)).toEqual({ breathing: null, pulse: null });
    expect(demoReadings("propped", PULSE_READY_SECONDS - 0.1).pulse).toBeNull();
  });

  it("only simulates a face pulse in the propped-up placement", () => {
    for (let t = 0; t <= DEMO_SECONDS; t += 1) {
      expect(demoReadings("nightstand", t).pulse).toBeNull();
    }
    expect(demoReadings("propped", DEMO_SECONDS).pulse).not.toBeNull();
    expect(demoSummary("nightstand").pulse).toBeNull();
  });

  it("is deterministic and stays in a calm, plausible range", () => {
    expect(demoSummary("propped")).toEqual(demoSummary("propped"));
    const summary = demoSummary("propped");
    expect(summary.breathing.low).toBeGreaterThanOrEqual(12);
    expect(summary.breathing.high).toBeLessThanOrEqual(16);
    expect(summary.pulse!.low).toBeGreaterThanOrEqual(60);
    expect(summary.pulse!.high).toBeLessThanOrEqual(68);
    expect(demoReadings("propped", 17.3)).toEqual(demoReadings("propped", 17.3));
  });

  it("matches the final readings after the demo ends instead of extrapolating", () => {
    expect(demoReadings("propped", DEMO_SECONDS + 100)).toEqual(demoReadings("propped", DEMO_SECONDS));
  });

  it("produces finite waveform windows", () => {
    for (const wave of [breathingWave, pulseWave]) {
      const values = waveWindow(wave, 12, 6, 20);
      expect(values).toHaveLength(120);
      expect(values.every(Number.isFinite)).toBe(true);
    }
  });

  it("draws a smooth breathing trace with no jumps, including the window before the demo starts", () => {
    const values = waveWindow(breathingWave, 0, 12, 10);
    const steps = values.slice(1).map((v, i) => Math.abs(v - values[i]));
    expect(Math.max(...steps)).toBeLessThan(0.25);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
  });
});
