export type StartAttempt = { isCurrent: () => boolean };

export type StartOutcome = { kind: "started" } | { kind: "stale" } | { kind: "failed"; error: unknown };

export function createStartGate() {
  let generation = 0;
  const invalidate = () => {
    generation += 1;
  };
  const begin = (): StartAttempt => {
    invalidate();
    const attempt = generation;
    return { isCurrent: () => attempt === generation };
  };
  return { begin, invalidate };
}

export async function settleStart(attempt: StartAttempt, pending: Promise<unknown>, stopNative: () => void): Promise<StartOutcome> {
  try {
    await pending;
  } catch (error) {
    if (!attempt.isCurrent()) return { kind: "stale" };
    stopNative();
    return { kind: "failed", error };
  }
  return attempt.isCurrent() ? { kind: "started" } : { kind: "stale" };
}
