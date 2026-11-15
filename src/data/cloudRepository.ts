import { ConvexClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { AlertSource } from "../../convex/lib/demoMachine";
import type { DemoRepository, SessionCredential, SessionSnapshot } from "./types";

export type CloudStatus =
  | { state: "checking" }
  | { state: "connected"; url: string }
  | { state: "unavailable"; reason: string };

export const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL ?? "";

function sessionArgs(cred: SessionCredential) {
  return { sessionId: cred.id as Id<"demoSessions">, token: cred.token };
}

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\[Request ID: [^\]]+\]\s*/g, "").replace(/^Server Error\s*/i, "").trim();
}

export async function probeCloud(): Promise<{ status: CloudStatus; client: ConvexClient | null }> {
  if (!CONVEX_URL) {
    return { status: { state: "unavailable", reason: "EXPO_PUBLIC_CONVEX_URL is not set in this build." }, client: null };
  }
  const client = new ConvexClient(CONVEX_URL);
  try {
    const result = await Promise.race([
      client.query(api.health.status, {}),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
    ]);
    if (result?.service !== "nightsignal") throw new Error("Unexpected health response");
    return { status: { state: "connected", url: CONVEX_URL }, client };
  } catch (error) {
    void client.close();
    const message = errorText(error);
    const reason = /Could not find public function/i.test(message)
      ? "Bennet functions are not deployed to the Convex deployment yet (no authorized deploy has run)."
      : message === "timeout"
        ? "Convex deployment did not respond."
        : `Convex check failed: ${message}`;
    return { status: { state: "unavailable", reason }, client: null };
  }
}

export class CloudDemoRepository implements DemoRepository {
  storage = "cloud" as const;
  constructor(private client: ConvexClient) {}

  async startSession(label: string, token: string) {
    return await this.client.mutation(api.demo.startSession, { label, token });
  }

  async endSession(cred: SessionCredential) {
    await this.wrap(this.client.mutation(api.demo.endSession, sessionArgs(cred)));
  }

  async triggerAlert(cred: SessionCredential, countdownSeconds: number, source: AlertSource) {
    await this.wrap(this.client.mutation(api.demo.triggerTestAlert, { ...sessionArgs(cred), countdownSeconds, source }));
  }

  async imOkay(cred: SessionCredential, alertId: string) {
    await this.wrap(this.client.mutation(api.demo.respondImOkay, { ...sessionArgs(cred), alertId: alertId as Id<"demoAlerts"> }));
  }

  async acknowledge(cred: SessionCredential, alertId: string) {
    await this.wrap(this.client.mutation(api.demo.acknowledge, { ...sessionArgs(cred), alertId: alertId as Id<"demoAlerts"> }));
  }

  watchSession(cred: SessionCredential, onData: (snapshot: SessionSnapshot | null, error?: string) => void) {
    return this.client.onUpdate(
      api.demo.getSession,
      sessionArgs(cred),
      (snapshot) => onData(snapshot as SessionSnapshot),
      (error) => onData(null, errorText(error)),
    );
  }

  private async wrap<T>(promise: Promise<T>) {
    try {
      return await promise;
    } catch (error) {
      throw new Error(errorText(error));
    }
  }
}
