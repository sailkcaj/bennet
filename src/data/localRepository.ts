import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import {
  isOpenAlert,
  nextAlertState,
  validateCountdownSeconds,
  type AlertAction,
  type AlertSource,
  type EventKind,
} from "../../convex/lib/demoMachine";
import type { AlertView, DemoRepository, EventView, SessionCredential, SessionSnapshot, SessionView } from "./types";

const STORE_KEY = "nightsignal.local.demo.v1";

type LocalState = {
  sessions: Record<string, SessionView & { tokenHash: string }>;
  alerts: Record<string, AlertView & { sessionId: string }>;
  events: (EventView & { sessionId: string })[];
};

async function hashToken(token: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, token);
}

function newId() {
  return Array.from(Crypto.getRandomBytes(12), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Device-only fallback used while the Convex functions are not deployed. It applies the same
 * transition rules (convex/lib/demoMachine.ts) and validates the same per-session token hash.
 */
export class LocalDemoRepository implements DemoRepository {
  storage = "device" as const;
  private state: LocalState | null = null;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;

  private async load(): Promise<LocalState> {
    if (this.state) return this.state;
    const raw = await AsyncStorage.getItem(STORE_KEY);
    this.state = raw ? (JSON.parse(raw) as LocalState) : { sessions: {}, alerts: {}, events: [] };
    await this.expireDue();
    return this.state;
  }

  private async persist() {
    if (!this.state) return;
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(this.state));
    this.listeners.forEach((listener) => listener());
  }

  private addEvent(sessionId: string, alertId: string | null, kind: EventKind, fromState: EventView["fromState"], toState: EventView["toState"], at: number) {
    this.state!.events.push({ id: newId(), sessionId, alertId, kind, fromState, toState, at });
  }

  private async expireDue() {
    const state = this.state;
    if (!state) return;
    let changed = false;
    for (const alert of Object.values(state.alerts)) {
      if (alert.state !== "countdown" || Date.now() < alert.deadlineAt) continue;
      const result = nextAlertState(alert, { type: "expire", now: Math.max(Date.now(), alert.deadlineAt) });
      if (!result.ok) continue;
      this.addEvent(alert.sessionId, alert.id, result.event, alert.state, result.state, alert.deadlineAt);
      Object.assign(alert, { state: result.state, open: isOpenAlert(result.state), resolvedAt: result.resolvedAt });
      changed = true;
    }
    if (changed) await this.persist();
  }

  private ensureTimer() {
    if (this.timer || this.listeners.size === 0) return;
    this.timer = setInterval(() => void this.expireDue(), 500);
  }

  private async authorize(cred: SessionCredential) {
    const state = await this.load();
    const session = state.sessions[cred.id];
    if (!session || session.tokenHash !== (await hashToken(cred.token))) throw new Error("unauthorized");
    return session;
  }

  async startSession(label: string, token: string) {
    const state = await this.load();
    const id = newId();
    const now = Date.now();
    state.sessions[id] = {
      id,
      label: label.trim().slice(0, 60) || "Demonstration session",
      status: "active",
      startedAt: now,
      endedAt: null,
      tokenHash: await hashToken(token),
    };
    this.addEvent(id, null, "session_started", null, null, now);
    await this.persist();
    return id;
  }

  async endSession(cred: SessionCredential) {
    const session = await this.authorize(cred);
    if (session.status === "ended") return;
    if (Object.values(this.state!.alerts).some((a) => a.sessionId === session.id && isOpenAlert(a.state))) {
      throw new Error("Resolve the open test alert before ending the session");
    }
    const now = Date.now();
    Object.assign(session, { status: "ended", endedAt: now });
    this.addEvent(session.id, null, "session_ended", null, null, now);
    await this.persist();
  }

  async triggerAlert(cred: SessionCredential, countdownSeconds: number, source: AlertSource) {
    const session = await this.authorize(cred);
    if (session.status !== "active") throw new Error("Session has ended");
    const error = validateCountdownSeconds(countdownSeconds);
    if (error) throw new Error(error);
    if (Object.values(this.state!.alerts).some((a) => a.sessionId === session.id && isOpenAlert(a.state))) {
      throw new Error("A test alert is already open");
    }
    const now = Date.now();
    const id = newId();
    this.state!.alerts[id] = {
      id,
      sessionId: session.id,
      source,
      state: "countdown",
      open: true,
      countdownSeconds,
      triggeredAt: now,
      deadlineAt: now + countdownSeconds * 1000,
      resolvedAt: null,
    };
    this.addEvent(session.id, id, "alert_triggered", null, "countdown", now);
    await this.persist();
  }

  private async apply(cred: SessionCredential, alertId: string, action: AlertAction) {
    const session = await this.authorize(cred);
    const alert = this.state!.alerts[alertId];
    if (!alert || alert.sessionId !== session.id) throw new Error("unauthorized");
    const result = nextAlertState(alert, action);
    if (!result.ok) throw new Error(result.error);
    this.addEvent(session.id, alertId, result.event, alert.state, result.state, action.now);
    Object.assign(alert, { state: result.state, open: isOpenAlert(result.state), resolvedAt: result.resolvedAt });
    await this.persist();
  }

  imOkay(cred: SessionCredential, alertId: string) {
    return this.apply(cred, alertId, { type: "im_okay", now: Date.now() });
  }

  acknowledge(cred: SessionCredential, alertId: string) {
    return this.apply(cred, alertId, { type: "acknowledge", now: Date.now() });
  }

  watchSession(cred: SessionCredential, onData: (snapshot: SessionSnapshot | null, error?: string) => void) {
    let active = true;
    const emit = async () => {
      try {
        const session = await this.authorize(cred);
        const state = this.state!;
        const { tokenHash: _hash, ...view } = session;
        const snapshot: SessionSnapshot = {
          session: view,
          alerts: Object.values(state.alerts)
            .filter((a) => a.sessionId === session.id)
            .sort((a, b) => b.triggeredAt - a.triggeredAt)
            .map(({ sessionId: _s, ...alert }) => alert),
          events: state.events
            .filter((e) => e.sessionId === session.id)
            .sort((a, b) => b.at - a.at)
            .map(({ sessionId: _s, ...event }) => event),
        };
        if (active) onData(snapshot);
      } catch (error) {
        if (active) onData(null, error instanceof Error ? error.message : String(error));
      }
    };
    this.listeners.add(emit);
    this.ensureTimer();
    void emit();
    return () => {
      active = false;
      this.listeners.delete(emit);
      if (this.listeners.size === 0 && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  }
}
