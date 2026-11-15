import type { AlertSource, AlertState, EventKind } from "../../convex/lib/demoMachine";

export type Storage = "cloud" | "device";

export type SessionCredential = { id: string; token: string; storage: Storage; createdAt: number };

export type SessionView = {
  id: string;
  label: string;
  status: "active" | "ended";
  startedAt: number;
  endedAt: number | null;
};

export type AlertView = {
  id: string;
  source: AlertSource;
  state: AlertState;
  open: boolean;
  countdownSeconds: number;
  triggeredAt: number;
  deadlineAt: number;
  resolvedAt: number | null;
};

export type EventView = {
  id: string;
  alertId: string | null;
  kind: EventKind;
  fromState: AlertState | null;
  toState: AlertState | null;
  at: number;
};

export type SessionSnapshot = { session: SessionView; alerts: AlertView[]; events: EventView[] };

export interface DemoRepository {
  storage: Storage;
  startSession(label: string, token: string): Promise<string>;
  endSession(cred: SessionCredential): Promise<void>;
  triggerAlert(cred: SessionCredential, countdownSeconds: number, source: AlertSource): Promise<void>;
  imOkay(cred: SessionCredential, alertId: string): Promise<void>;
  acknowledge(cred: SessionCredential, alertId: string): Promise<void>;
  watchSession(cred: SessionCredential, onData: (snapshot: SessionSnapshot | null, error?: string) => void): () => void;
}
