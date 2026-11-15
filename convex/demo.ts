import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { assertTokenFormat, findAuthorizedSession, hashToken, requireSession } from "./lib/auth";
import { isOpenAlert, nextAlertState, validateCountdownSeconds, type AlertAction } from "./lib/demoMachine";
import { alertSourceValidator } from "./schema";

const credentials = { sessionId: v.id("demoSessions"), token: v.string() };

function publicSession(session: Doc<"demoSessions">) {
  return {
    id: session._id,
    label: session.label,
    status: session.status,
    dataKind: session.dataKind,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
  };
}

async function openAlert(ctx: MutationCtx, sessionId: Id<"demoSessions">) {
  const countdown = await ctx.db
    .query("demoAlerts")
    .withIndex("by_sessionId_and_state", (q) => q.eq("sessionId", sessionId).eq("state", "countdown"))
    .first();
  if (countdown) return countdown;
  return await ctx.db
    .query("demoAlerts")
    .withIndex("by_sessionId_and_state", (q) => q.eq("sessionId", sessionId).eq("state", "expired_unacknowledged"))
    .first();
}

async function applyAlertAction(
  ctx: MutationCtx,
  sessionId: Id<"demoSessions">,
  alertId: Id<"demoAlerts">,
  action: AlertAction,
) {
  const alert = await ctx.db.get("demoAlerts", alertId);
  if (!alert || alert.sessionId !== sessionId) throw new ConvexError("unauthorized");
  const result = nextAlertState(alert, action);
  if (!result.ok) throw new ConvexError(result.error);
  await ctx.db.patch("demoAlerts", alertId, { state: result.state, resolvedAt: result.resolvedAt });
  await ctx.db.insert("demoEvents", {
    sessionId,
    alertId,
    kind: result.event,
    fromState: alert.state,
    toState: result.state,
    at: action.now,
  });
  return result.state;
}

export const startSession = mutation({
  args: { token: v.string(), label: v.string() },
  handler: async (ctx, args) => {
    assertTokenFormat(args.token);
    const now = Date.now();
    const sessionId = await ctx.db.insert("demoSessions", {
      tokenHash: await hashToken(args.token),
      label: args.label.trim().slice(0, 60) || "Demonstration session",
      status: "active",
      dataKind: "synthetic_demo",
      startedAt: now,
      endedAt: null,
    });
    await ctx.db.insert("demoEvents", {
      sessionId,
      alertId: null,
      kind: "session_started",
      fromState: null,
      toState: null,
      at: now,
    });
    return sessionId;
  },
});

export const endSession = mutation({
  args: credentials,
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.sessionId, args.token);
    if (session.status === "ended") return null;
    if (await openAlert(ctx, session._id)) throw new ConvexError("Resolve the open test alert before ending the session");
    const now = Date.now();
    await ctx.db.patch("demoSessions", session._id, { status: "ended", endedAt: now });
    await ctx.db.insert("demoEvents", {
      sessionId: session._id,
      alertId: null,
      kind: "session_ended",
      fromState: null,
      toState: null,
      at: now,
    });
    return null;
  },
});

export const triggerTestAlert = mutation({
  args: { ...credentials, countdownSeconds: v.number(), source: alertSourceValidator },
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.sessionId, args.token);
    if (session.status !== "active") throw new ConvexError("Session has ended");
    const countdownError = validateCountdownSeconds(args.countdownSeconds);
    if (countdownError) throw new ConvexError(countdownError);
    if (await openAlert(ctx, session._id)) throw new ConvexError("A test alert is already open");
    const now = Date.now();
    const deadlineAt = now + args.countdownSeconds * 1000;
    const alertId = await ctx.db.insert("demoAlerts", {
      sessionId: session._id,
      source: args.source,
      state: "countdown",
      countdownSeconds: args.countdownSeconds,
      triggeredAt: now,
      deadlineAt,
      resolvedAt: null,
    });
    await ctx.db.insert("demoEvents", {
      sessionId: session._id,
      alertId,
      kind: "alert_triggered",
      fromState: null,
      toState: "countdown",
      at: now,
    });
    await ctx.scheduler.runAt(deadlineAt, internal.demo.expireAlert, { alertId });
    return alertId;
  },
});

export const respondImOkay = mutation({
  args: { ...credentials, alertId: v.id("demoAlerts") },
  handler: async (ctx, args) => {
    await requireSession(ctx, args.sessionId, args.token);
    return await applyAlertAction(ctx, args.sessionId, args.alertId, { type: "im_okay", now: Date.now() });
  },
});

export const acknowledge = mutation({
  args: { ...credentials, alertId: v.id("demoAlerts") },
  handler: async (ctx, args) => {
    await requireSession(ctx, args.sessionId, args.token);
    return await applyAlertAction(ctx, args.sessionId, args.alertId, { type: "acknowledge", now: Date.now() });
  },
});

export const expireAlert = internalMutation({
  args: { alertId: v.id("demoAlerts") },
  handler: async (ctx, args) => {
    const alert = await ctx.db.get("demoAlerts", args.alertId);
    if (!alert || alert.state !== "countdown") return null;
    const now = Math.max(Date.now(), alert.deadlineAt);
    await applyAlertAction(ctx, alert.sessionId, alert._id, { type: "expire", now });
    return null;
  },
});

export const getSession = query({
  args: credentials,
  handler: async (ctx, args) => {
    const session = await requireSession(ctx, args.sessionId, args.token);
    const alerts = await ctx.db
      .query("demoAlerts")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
      .order("desc")
      .take(50);
    const events = await ctx.db
      .query("demoEvents")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
      .order("desc")
      .take(200);
    return {
      session: publicSession(session),
      alerts: alerts.map((alert) => ({
        id: alert._id,
        source: alert.source,
        state: alert.state,
        open: isOpenAlert(alert.state),
        countdownSeconds: alert.countdownSeconds,
        triggeredAt: alert.triggeredAt,
        deadlineAt: alert.deadlineAt,
        resolvedAt: alert.resolvedAt,
      })),
      events: events.map((event) => ({
        id: event._id,
        alertId: event.alertId,
        kind: event.kind,
        fromState: event.fromState,
        toState: event.toState,
        at: event.at,
      })),
    };
  },
});

export const listSessions = query({
  args: { credentials: v.array(v.object(credentials)) },
  handler: async (ctx, args) => {
    if (args.credentials.length > 25) throw new ConvexError("Too many sessions requested");
    const sessions = [];
    for (const credential of args.credentials) {
      const session = await findAuthorizedSession(ctx, credential.sessionId, credential.token);
      if (session) sessions.push(publicSession(session));
    }
    return sessions;
  },
});
