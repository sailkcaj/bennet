import { describe, expect, it, vi } from "vitest";
import { createStartGate, settleStart } from "../startGate";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("sensor start gate", () => {
  it("never lets a stale start stop the newer session after stop then start", async () => {
    const gate = createStartGate();
    const stopNative = vi.fn();
    const first = deferred();
    const firstAttempt = gate.begin();
    const firstOutcome = settleStart(firstAttempt, first.promise, stopNative);

    gate.invalidate();
    const second = deferred();
    const secondAttempt = gate.begin();
    const secondOutcome = settleStart(secondAttempt, second.promise, stopNative);
    second.resolve();
    await expect(secondOutcome).resolves.toEqual({ kind: "started" });

    first.resolve();
    await expect(firstOutcome).resolves.toEqual({ kind: "stale" });
    expect(stopNative).not.toHaveBeenCalled();
    expect(secondAttempt.isCurrent()).toBe(true);
  });

  it("ignores a stale start that fails after a newer start began", async () => {
    const gate = createStartGate();
    const stopNative = vi.fn();
    const first = deferred();
    const firstOutcome = settleStart(gate.begin(), first.promise, stopNative);
    const secondAttempt = gate.begin();

    first.reject(new Error("Start was cancelled."));
    await expect(firstOutcome).resolves.toEqual({ kind: "stale" });
    expect(stopNative).not.toHaveBeenCalled();
    expect(secondAttempt.isCurrent()).toBe(true);
  });

  it("reports a stop or unmount during a pending start as stale without stopping again", async () => {
    const gate = createStartGate();
    const stopNative = vi.fn();
    const pending = deferred();
    const outcome = settleStart(gate.begin(), pending.promise, stopNative);
    gate.invalidate();
    pending.resolve();
    await expect(outcome).resolves.toEqual({ kind: "stale" });
    expect(stopNative).not.toHaveBeenCalled();
  });

  it("cleans up natively once when the current start fails", async () => {
    const gate = createStartGate();
    const stopNative = vi.fn();
    const error = new Error("The flash could not be turned on");
    const outcome = await settleStart(gate.begin(), Promise.reject(error), stopNative);
    expect(outcome).toEqual({ kind: "failed", error });
    expect(stopNative).toHaveBeenCalledTimes(1);
  });
});
