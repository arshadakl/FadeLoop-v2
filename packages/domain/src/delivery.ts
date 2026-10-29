// Unknown is distinct from retryable: external acceptance may already have occurred.
export type DeliveryOutcome =
  | { status: "sent"; providerMessageId: string }
  | { status: "retryable"; reason: string; retryAt: number }
  | { status: "failed"; reason: string }
  | { status: "unknown"; attemptId: string };

export type Clock = { now(): number };
