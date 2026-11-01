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
  confirmationButtonEnabled: z.boolean().default(true),
  confirmationButtonText: z.string().min(1).max(20).default("Send Me"),
  confirmationPromptText: z.string().max(1000).nullable().optional(),
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

export const createCampaignInputSchema = z.strictObject({
  accountId: z.string().min(1).max(256),
  mediaId: z.string().min(1).max(256),
  status: campaignStatusSchema.default("published"),
  matchMode: matchModeSchema.default("exact_keyword"),
  keywords: z.array(z.string().min(1).max(256)).max(50).default([]),
  replyTemplate: z.string().min(1).max(1000),
  resourceUrl: z.string().url().max(2048).nullable().optional(),
  confirmationButtonEnabled: z.boolean().default(true),
  confirmationButtonText: z.string().min(1).max(20).default("Send Me"),
  confirmationPromptText: z.string().max(1000).nullable().optional(),
});
export type CreateCampaignInput = z.infer<typeof createCampaignInputSchema>;

export const updateCampaignStatusInputSchema = z.strictObject({
  status: campaignStatusSchema,
});
export type UpdateCampaignStatusInput = z.infer<
  typeof updateCampaignStatusInputSchema
>;

export const updateCampaignInputSchema = z.strictObject({
  status: campaignStatusSchema.optional(),
  matchMode: matchModeSchema.optional(),
  keywords: z.array(z.string().min(1).max(256)).max(50).optional(),
  replyTemplate: z.string().min(1).max(1000).optional(),
  resourceUrl: z.string().url().max(2048).nullable().optional(),
  confirmationButtonEnabled: z.boolean().optional(),
  confirmationButtonText: z.string().min(1).max(20).optional(),
  confirmationPromptText: z.string().max(1000).nullable().optional(),
});
export type UpdateCampaignInput = z.infer<typeof updateCampaignInputSchema>;
