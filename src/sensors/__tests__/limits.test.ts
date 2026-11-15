import { describe, expect, it } from "vitest";
import { BREATHING_WINDOW_SECONDS, FACE_WINDOW_SECONDS, FINGERTIP_WINDOW_SECONDS } from "../../signal/pulse";
import { FINGERTIP_TORCH_LEVEL, MAX_SESSION_SECONDS, SESSION_LIMITS } from "../limits";

describe("sensor session limits", () => {
  it("caps every experiment at 30 seconds", () => {
    expect(MAX_SESSION_SECONDS).toBe(30);
    for (const seconds of Object.values(SESSION_LIMITS)) {
      expect(seconds).toBe(MAX_SESSION_SECONDS);
    }
  });

  it("leaves acquisition headroom so every estimator window can fill before the cap", () => {
    expect(SESSION_LIMITS.ppg - FINGERTIP_WINDOW_SECONDS).toBeGreaterThanOrEqual(5);
    expect(SESSION_LIMITS.face - FACE_WINDOW_SECONDS).toBeGreaterThanOrEqual(5);
    expect(SESSION_LIMITS.depth - BREATHING_WINDOW_SECONDS).toBeGreaterThanOrEqual(5);
  });

  it("keeps the fingertip flash at reduced brightness", () => {
    expect(FINGERTIP_TORCH_LEVEL).toBeGreaterThan(0);
    expect(FINGERTIP_TORCH_LEVEL).toBeLessThanOrEqual(0.5);
  });
});
