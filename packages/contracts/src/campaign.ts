import { z } from "zod";

export const matchModeSchema = z.enum(["exact_keyword", "any_comment"]);
export type MatchMode = z.infer<typeof matchModeSchema>;

export const campaignStatusSchema = z.enum(["published", "paused"]);
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;

export const campaignSchema = z.strictObject({
  id: z.string().min(1).max(256),
  workspaceId: z.string().min(1).max(256),
  accountId: z.string().min(1).max(256),
  mediaId: z.string().min(1).max(256),
  status: campaignStatusSchema,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type Campaign = z.infer<typeof campaignSchema>;

export const campaignRevisionSchema = z.strictObject({
  id: z.string().min(1).max(256),
  campaignId: z.string().min(1).max(256),
  matchMode: matchModeSchema,
  keywords: z.array(z.string().min(1).max(256)).max(50),
  replyTemplate: z.string().min(1).max(1000),
  resourceUrl: z.string().url().max(2048).nullable().optional(),
  createdAt: z.number().int().nonnegative(),
});
export type CampaignRevision = z.infer<typeof campaignRevisionSchema>;

export const deliveryClaimSchema = z.strictObject({
  actionKey: z.string().min(1).max(512),
  workspaceId: z.string().min(1).max(256),
  accountId: z.string().min(1).max(256),
  commentId: z.string().min(1).max(256),
  mediaId: z.string().min(1).max(256),
  campaignId: z.string().min(1).max(256),
  revisionId: z.string().min(1).max(256),
  claimedAt: z.number().int().nonnegative(),
});
export type DeliveryClaim = z.infer<typeof deliveryClaimSchema>;
