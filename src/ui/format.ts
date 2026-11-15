import type { AlertState, EventKind } from "../../convex/lib/demoMachine";

export function formatTime(ms: number) {
  const d = new Date(ms);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
}

export const ALERT_STATE_TEXT: Record<AlertState, string> = {
  countdown: "Countdown running",
  cancelled: "Cancelled — I'm okay",
  expired_unacknowledged: "Unacknowledged test event",
  acknowledged: "Acknowledged",
};

export const EVENT_TEXT: Record<EventKind, string> = {
  session_started: "Demonstration session started",
  session_ended: "Session ended",
  alert_triggered: "Test alert triggered",
  im_okay: "\u201CI'm okay\u201D — countdown cancelled",
  alert_expired: "Countdown expired — unacknowledged test event",
  acknowledged: "Test event acknowledged",
};
