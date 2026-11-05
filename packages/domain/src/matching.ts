import type { Campaign, CampaignRevision } from "@fadeloop/contracts/campaign";

export interface ActiveCampaignRevision {
  campaign: Campaign;
  revision: CampaignRevision;
}

/**
 * Checks if a comment matches an active campaign revision.
 * Rules:
 * - If matchMode is "any_comment", matches any non-empty comment.
 * - If matchMode is "exact_keyword", normalizes text (lowercase, trimmed)
 *   and checks if any normalized keyword exactly matches or is present as a standalone word.
 */
export function matchComment(
  commentText: string,
  revision: CampaignRevision,
): boolean {
  const trimmed = commentText.trim();
  if (!trimmed) return false;

  if (revision.matchMode === "any_comment") {
    return true;
  }

  const normalizedComment = trimmed.toLowerCase();
  const rawWords = normalizedComment.split(/\s+/);
  const cleanedWords = normalizedComment
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  for (const kw of revision.keywords) {
    const normalizedKw = kw.trim().toLowerCase();
    if (!normalizedKw) continue;
    // Exact match or matches a specific token (even with attached punctuation or emojis)
    if (
      normalizedComment === normalizedKw ||
      rawWords.includes(normalizedKw) ||
      cleanedWords.includes(normalizedKw)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Validates whether an event is still within the Meta private reply eligibility window.
 * Meta private reply contract strictly requires sending within 7 days (7 * 86400 * 1000 ms)
 * of the comment occurrence.
 */
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes tolerance for distributed server clock skew

export function isCommentWithinReplyWindow(
  occurredAt: number,
  now: number,
): boolean {
  if (occurredAt > now + CLOCK_SKEW_TOLERANCE_MS) return false; // Future event timestamp rejection with tolerance
  return now - occurredAt <= SEVEN_DAYS_MS;
}
