export type AlertState = "countdown" | "cancelled" | "expired_unacknowledged" | "acknowledged";
export type AlertSource = "manual_test" | "simulated_distress";
export type EventKind =
  | "session_started"
  | "session_ended"
  | "alert_triggered"
  | "im_okay"
  | "alert_expired"
  | "acknowledged";

export type AlertAction = { type: "im_okay" | "expire" | "acknowledge"; now: number };

export type TransitionResult =
  | { ok: true; state: AlertState; event: EventKind; resolvedAt: number | null }
  | { ok: false; error: string };

export const COUNTDOWN_MIN_SECONDS = 5;
export const COUNTDOWN_MAX_SECONDS = 300;

export function validateCountdownSeconds(seconds: number): string | null {
  if (!Number.isFinite(seconds) || !Number.isInteger(seconds)) return "Countdown must be a whole number of seconds";
  if (seconds < COUNTDOWN_MIN_SECONDS || seconds > COUNTDOWN_MAX_SECONDS) {
    return `Countdown must be between ${COUNTDOWN_MIN_SECONDS} and ${COUNTDOWN_MAX_SECONDS} seconds`;
  }
  return null;
}

export function isOpenAlert(state: AlertState): boolean {
  return state === "countdown" || state === "expired_unacknowledged";
}

export function nextAlertState(alert: { state: AlertState; deadlineAt: number }, action: AlertAction): TransitionResult {
  switch (action.type) {
    case "im_okay":
      if (alert.state !== "countdown") return { ok: false, error: "Only a running countdown can be cancelled" };
      if (action.now >= alert.deadlineAt) return { ok: false, error: "Countdown already expired" };
      return { ok: true, state: "cancelled", event: "im_okay", resolvedAt: action.now };
    case "expire":
      if (alert.state !== "countdown") return { ok: false, error: "Only a running countdown can expire" };
      if (action.now < alert.deadlineAt) return { ok: false, error: "Countdown has not reached its deadline" };
      return { ok: true, state: "expired_unacknowledged", event: "alert_expired", resolvedAt: null };
    case "acknowledge":
      if (alert.state !== "expired_unacknowledged") return { ok: false, error: "Only an unacknowledged test event can be acknowledged" };
      return { ok: true, state: "acknowledged", event: "acknowledged", resolvedAt: action.now };
  }
}
