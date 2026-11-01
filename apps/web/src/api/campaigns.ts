import type {
  CreateCampaignInput,
  UpdateCampaignInput,
} from "@fadeloop/contracts/campaign";
import { getJSON, sendJSON } from "./client";

export interface CampaignData {
  campaign: {
    id: string;
    workspaceId: string;
    accountId: string;
    mediaId: string;
    status: "published" | "paused";
    createdAt: number;
    updatedAt: number;
  };
  revision: {
    id: string;
    campaignId: string;
    matchMode: "exact_keyword" | "any_comment";
    keywords: string[];
    replyTemplate: string;
    resourceUrl?: string | null;
    confirmationButtonEnabled?: boolean;
    confirmationButtonText?: string;
    confirmationPromptText?: string | null;
    createdAt: number;
  };
}

export interface CampaignsResponse {
  campaigns: CampaignData[];
}

export interface DeliveryOutcomeData {
  id: string;
  action_key: string;
  account_id: string;
  status: "sent" | "retryable" | "failed" | "unknown";
  provider_message_id: string | null;
  error_code: string | null;
  attempt_count: number;
  occurred_at: number;
}

export interface DeliveriesResponse {
  deliveries: DeliveryOutcomeData[];
}

export async function fetchCampaigns(
  cursor?: number,
  signal?: AbortSignal,
): Promise<CampaignsResponse> {
  const query = cursor ? `?cursor=${cursor}` : "";
  return getJSON<CampaignsResponse>(`/api/campaigns${query}`, signal);
}

export async function createCampaign(
  input: CreateCampaignInput,
  signal?: AbortSignal,
): Promise<CampaignData> {
  return sendJSON<CampaignData>("/api/campaigns", "POST", input, signal);
}

export async function toggleCampaignStatus(
  campaignId: string,
  status: "published" | "paused",
  signal?: AbortSignal,
): Promise<{ success: boolean; status: string }> {
  return sendJSON<{ success: boolean; status: string }>(
    `/api/campaigns/${campaignId}`,
    "PUT",
    { status },
    signal,
  );
}

export async function updateCampaign(
  campaignId: string,
  input: UpdateCampaignInput,
  signal?: AbortSignal,
): Promise<{
  success: boolean;
  status: string;
  campaign: CampaignData["campaign"];
  revision: CampaignData["revision"];
}> {
  return sendJSON<{
    success: boolean;
    status: string;
    campaign: CampaignData["campaign"];
    revision: CampaignData["revision"];
  }>(`/api/campaigns/${campaignId}`, "PUT", input, signal);
}

export async function deleteCampaign(
  campaignId: string,
  signal?: AbortSignal,
): Promise<{ success: boolean; id: string }> {
  return sendJSON<{ success: boolean; id: string }>(
    `/api/campaigns/${campaignId}`,
    "DELETE",
    undefined,
    signal,
  );
}

export async function fetchDeliveries(
  cursor?: number,
  signal?: AbortSignal,
): Promise<DeliveriesResponse> {
  const query = cursor ? `?cursor=${cursor}` : "";
  return getJSON<DeliveriesResponse>(`/api/deliveries${query}`, signal);
}
