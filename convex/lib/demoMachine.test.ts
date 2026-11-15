import { describe, expect, it } from "vitest";
import { nextAlertState, validateCountdownSeconds } from "./demoMachine";

const countdown = { state: "countdown" as const, deadlineAt: 10_000 };

describe("demo alert state machine", () => {
  it("cancels a running countdown with I'm okay", () => {
    expect(nextAlertState(countdown, { type: "im_okay", now: 5_000 })).toEqual({
      ok: true,
      state: "cancelled",
      event: "im_okay",
      resolvedAt: 5_000,
    });
  });

  it("expires only at or after the deadline", () => {
    expect(nextAlertState(countdown, { type: "expire", now: 9_999 }).ok).toBe(false);
    expect(nextAlertState(countdown, { type: "expire", now: 10_000 })).toMatchObject({ ok: true, state: "expired_unacknowledged" });
  });

  it("refuses I'm okay after the deadline", () => {
    expect(nextAlertState(countdown, { type: "im_okay", now: 10_000 }).ok).toBe(false);
  });

  it("acknowledges only an expired unacknowledged event", () => {
    expect(nextAlertState(countdown, { type: "acknowledge", now: 1 }).ok).toBe(false);
    expect(nextAlertState({ state: "expired_unacknowledged", deadlineAt: 10_000 }, { type: "acknowledge", now: 12_000 })).toMatchObject({
      ok: true,
      state: "acknowledged",
    });
  });

  it("treats cancelled and acknowledged as terminal", () => {
    for (const state of ["cancelled", "acknowledged"] as const) {
      for (const type of ["im_okay", "expire", "acknowledge"] as const) {
        expect(nextAlertState({ state, deadlineAt: 0 }, { type, now: 50_000 }).ok).toBe(false);
      }
    }
  });

  it("validates countdown bounds", () => {
    expect(validateCountdownSeconds(30)).toBeNull();
    expect(validateCountdownSeconds(2)).not.toBeNull();
    expect(validateCountdownSeconds(Number.NaN)).not.toBeNull();
    expect(validateCountdownSeconds(12.5)).not.toBeNull();
  });
});
