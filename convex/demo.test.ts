// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const tokenA = "a".repeat(64);
const tokenB = "b".repeat(64);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function startedSession(token = tokenA) {
  const t = convexTest(schema, modules);
  const sessionId = await t.mutation(api.demo.startSession, { token, label: "Synthetic demo" });
  return { t, sessionId };
}

describe("session token authorization", () => {
  it("rejects malformed tokens at session start", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.demo.startSession, { token: "short", label: "x" })).rejects.toThrow(/invalid_token_format/);
  });

  it("stores only a hash of the token", async () => {
    const { t, sessionId } = await startedSession();
    const stored = await t.run(async (ctx) => await ctx.db.get("demoSessions", sessionId));
    expect(stored?.tokenHash).not.toContain(tokenA);
    expect(stored?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses reads and writes with the wrong token", async () => {
    const { t, sessionId } = await startedSession();
    await expect(t.query(api.demo.getSession, { sessionId, token: tokenB })).rejects.toThrow(/unauthorized/);
    await expect(
      t.mutation(api.demo.triggerTestAlert, { sessionId, token: tokenB, countdownSeconds: 10, source: "manual_test" }),
    ).rejects.toThrow(/unauthorized/);
    await expect(t.mutation(api.demo.endSession, { sessionId, token: tokenB })).rejects.toThrow(/unauthorized/);
  });

  it("refuses acting on another session's alert", async () => {
    const t = convexTest(schema, modules);
    const sessionA = await t.mutation(api.demo.startSession, { token: tokenA, label: "A" });
    const sessionB = await t.mutation(api.demo.startSession, { token: tokenB, label: "B" });
    const alertId = await t.mutation(api.demo.triggerTestAlert, {
      sessionId: sessionA,
      token: tokenA,
      countdownSeconds: 10,
      source: "manual_test",
    });
    await expect(t.mutation(api.demo.respondImOkay, { sessionId: sessionB, token: tokenB, alertId })).rejects.toThrow(/unauthorized/);
  });

  it("lists only sessions whose token matches", async () => {
    const t = convexTest(schema, modules);
    const sessionA = await t.mutation(api.demo.startSession, { token: tokenA, label: "A" });
    const sessionB = await t.mutation(api.demo.startSession, { token: tokenB, label: "B" });
    const listed = await t.query(api.demo.listSessions, {
      credentials: [
        { sessionId: sessionA, token: tokenA },
        { sessionId: sessionB, token: tokenA },
      ],
    });
    expect(listed.map((s) => s.id)).toEqual([sessionA]);
  });
});

describe("demo test-alert transitions", () => {
  it("cancels a countdown with I'm okay and records events", async () => {
    const { t, sessionId } = await startedSession();
    const alertId = await t.mutation(api.demo.triggerTestAlert, { sessionId, token: tokenA, countdownSeconds: 30, source: "manual_test" });
    await expect(t.mutation(api.demo.triggerTestAlert, { sessionId, token: tokenA, countdownSeconds: 30, source: "manual_test" })).rejects.toThrow(
      /already open/,
    );
    expect(await t.mutation(api.demo.respondImOkay, { sessionId, token: tokenA, alertId })).toBe("cancelled");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const snapshot = await t.query(api.demo.getSession, { sessionId, token: tokenA });
    expect(snapshot.alerts[0].state).toBe("cancelled");
    expect(snapshot.events.map((e) => e.kind).reverse()).toEqual(["session_started", "alert_triggered", "im_okay"]);
  });

  it("expires an unanswered countdown on the server, then acknowledges", async () => {
    const { t, sessionId } = await startedSession();
    const alertId = await t.mutation(api.demo.triggerTestAlert, {
      sessionId,
      token: tokenA,
      countdownSeconds: 10,
      source: "simulated_distress",
    });
    await expect(t.mutation(api.demo.acknowledge, { sessionId, token: tokenA, alertId })).rejects.toThrow();
    vi.advanceTimersByTime(10_000);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    let snapshot = await t.query(api.demo.getSession, { sessionId, token: tokenA });
    expect(snapshot.alerts[0].state).toBe("expired_unacknowledged");
    await expect(t.mutation(api.demo.respondImOkay, { sessionId, token: tokenA, alertId })).rejects.toThrow();
    await expect(t.mutation(api.demo.endSession, { sessionId, token: tokenA })).rejects.toThrow(/Resolve/);
    expect(await t.mutation(api.demo.acknowledge, { sessionId, token: tokenA, alertId })).toBe("acknowledged");
    await t.mutation(api.demo.endSession, { sessionId, token: tokenA });
    snapshot = await t.query(api.demo.getSession, { sessionId, token: tokenA });
    expect(snapshot.session.status).toBe("ended");
    expect(snapshot.events.map((e) => e.kind).reverse()).toEqual([
      "session_started",
      "alert_triggered",
      "alert_expired",
      "acknowledged",
      "session_ended",
    ]);
  });

  it("rejects out-of-range countdowns", async () => {
    const { t, sessionId } = await startedSession();
    await expect(
      t.mutation(api.demo.triggerTestAlert, { sessionId, token: tokenA, countdownSeconds: 1, source: "manual_test" }),
    ).rejects.toThrow(/between/);
  });
});
