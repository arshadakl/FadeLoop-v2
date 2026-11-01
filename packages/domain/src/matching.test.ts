import type { CampaignRevision } from "@fadeloop/contracts/campaign";
import { describe, expect, it } from "vitest";
import {
  isCommentWithinReplyWindow,
  matchComment,
  SEVEN_DAYS_MS,
} from "./matching";

describe("Comment campaign matching", () => {
  const baseRevision: CampaignRevision = {
    id: "rev_1",
    campaignId: "camp_1",
    matchMode: "exact_keyword",
    keywords: ["price", "link", "coupon"],
    replyTemplate: "Here is your link!",
    resourceUrl: "https://example.com/link",
    confirmationButtonEnabled: false,
    confirmationButtonText: "Send Me",
    createdAt: 1000,
  };

  it("matches exact keyword case-insensitively and whitespace-trimmed", () => {
    expect(matchComment("price", baseRevision)).toBe(true);
    expect(matchComment(" PRICE ", baseRevision)).toBe(true);
    expect(matchComment("link", baseRevision)).toBe(true);
    expect(matchComment("what is the price please", baseRevision)).toBe(true);
    expect(matchComment("random text without trigger", baseRevision)).toBe(
      false,
    );
  });

  it("does not match partial subwords with exact_keyword", () => {
    // "blink" contains "link" as substring, but is not the word "link"
    expect(matchComment("blink and you miss it", baseRevision)).toBe(false);
    expect(matchComment("priceless moment", baseRevision)).toBe(false);
  });

  it("matches any comment if matchMode is any_comment", () => {
    const anyRevision: CampaignRevision = {
      ...baseRevision,
      matchMode: "any_comment",
      keywords: [],
    };
    expect(matchComment("hello", anyRevision)).toBe(true);
    expect(matchComment("   ", anyRevision)).toBe(false); // empty comments ignored
  });

  it("enforces Meta 7-day private reply window", () => {
    const now = 1700000000000;
    const sixDaysAgo = now - 6 * 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - SEVEN_DAYS_MS;
    const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
    const future = now + 1000;

    expect(isCommentWithinReplyWindow(sixDaysAgo, now)).toBe(true);
    expect(isCommentWithinReplyWindow(sevenDaysAgo, now)).toBe(true);
    expect(isCommentWithinReplyWindow(eightDaysAgo, now)).toBe(false);
    expect(isCommentWithinReplyWindow(future, now)).toBe(false);
  });
});
