import { query } from "./_generated/server";

export const status = query({
  args: {},
  handler: async () => ({ service: "nightsignal" as const, schemaVersion: 1 }),
});
