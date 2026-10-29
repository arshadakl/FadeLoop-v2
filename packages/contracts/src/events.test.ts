import { describe, expect, it } from "vitest";
import { automationEventSchema } from "./events";

const common = {
  schemaVersion: 1,
  accountId: "account",
  providerEventKey: "event",
  occurredAt: 1,
  receivedAt: 2,
};
describe("automation trust boundary", () => {
  it("requires comment identity and media rather than accepting an incomplete event", () => {
    expect(
      automationEventSchema.safeParse({
        ...common,
        kind: "comment.created",
        text: "link",
      }).success,
    ).toBe(false);
  });
  it("rejects a tenant identity supplied in an external queue payload", () => {
    expect(
      automationEventSchema.safeParse({
        ...common,
        kind: "postback.received",
        messagingUserId: "person",
        interactionPayload: "continue",
        workspaceId: "other",
      }).success,
    ).toBe(false);
  });
  it("preserves large provider identifiers as strings", () => {
    const id = "99999999999999999999";
    const event = automationEventSchema.parse({
      ...common,
      kind: "comment.created",
      mediaId: id,
      commentId: id,
      text: "link",
    });
    expect(event.kind === "comment.created" && event.commentId).toBe(id);
  });
});
