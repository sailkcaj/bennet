import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const alertStateValidator = v.union(
  v.literal("countdown"),
  v.literal("cancelled"),
  v.literal("expired_unacknowledged"),
  v.literal("acknowledged"),
);

export const alertSourceValidator = v.union(v.literal("manual_test"), v.literal("simulated_distress"));

export const eventKindValidator = v.union(
  v.literal("session_started"),
  v.literal("session_ended"),
  v.literal("alert_triggered"),
  v.literal("im_okay"),
  v.literal("alert_expired"),
  v.literal("acknowledged"),
);

export default defineSchema({
  demoSessions: defineTable({
    tokenHash: v.string(),
    label: v.string(),
    status: v.union(v.literal("active"), v.literal("ended")),
    dataKind: v.literal("synthetic_demo"),
    startedAt: v.number(),
    endedAt: v.union(v.number(), v.null()),
  }),
  demoAlerts: defineTable({
    sessionId: v.id("demoSessions"),
    source: alertSourceValidator,
    state: alertStateValidator,
    countdownSeconds: v.number(),
    triggeredAt: v.number(),
    deadlineAt: v.number(),
    resolvedAt: v.union(v.number(), v.null()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_state", ["sessionId", "state"]),
  demoEvents: defineTable({
    sessionId: v.id("demoSessions"),
    alertId: v.union(v.id("demoAlerts"), v.null()),
    kind: eventKindValidator,
    fromState: v.union(alertStateValidator, v.null()),
    toState: v.union(alertStateValidator, v.null()),
    at: v.number(),
  }).index("by_sessionId", ["sessionId"]),
});
