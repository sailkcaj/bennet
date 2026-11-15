import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function assertTokenFormat(token: string): void {
  if (!TOKEN_PATTERN.test(token)) throw new ConvexError("invalid_token_format");
}

export async function findAuthorizedSession(
  ctx: QueryCtx,
  sessionId: Id<"demoSessions">,
  token: string,
): Promise<Doc<"demoSessions"> | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const session = await ctx.db.get("demoSessions", sessionId);
  if (!session) return null;
  return constantTimeEqual(session.tokenHash, await hashToken(token)) ? session : null;
}

export async function requireSession(
  ctx: QueryCtx,
  sessionId: Id<"demoSessions">,
  token: string,
): Promise<Doc<"demoSessions">> {
  const session = await findAuthorizedSession(ctx, sessionId, token);
  if (!session) throw new ConvexError("unauthorized");
  return session;
}
