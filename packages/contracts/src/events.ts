import { z } from "zod";

const identity = z.string().min(1).max(1024);
const shared = {
  schemaVersion: z.literal(1),
  accountId: identity,
  providerEventKey: identity,
  occurredAt: z.number().int().nonnegative(),
  receivedAt: z.number().int().nonnegative(),
};

export const automationEventSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...shared,
    kind: z.literal("comment.created"),
    mediaId: identity,
    commentId: identity,
    text: z.string().max(10000),
  }),
  z.strictObject({
    ...shared,
    kind: z.literal("message.received"),
    messagingUserId: identity,
    text: z.string().max(10000),
    interactionPayload: z.string().max(2048).optional(),
  }),
  z.strictObject({
    ...shared,
    kind: z.literal("postback.received"),
    messagingUserId: identity,
    interactionPayload: z.string().min(1).max(2048),
  }),
]);

export type AutomationEvent = z.infer<typeof automationEventSchema>;
