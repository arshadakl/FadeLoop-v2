import { encodeBase64url } from "./encoding";

const stateLifetimeMs = 10 * 60 * 1000;

export interface OAuthStateStore {
  // Implement as one atomic conditional mutation: digest + owner + expiresAt > now.
  // Return true once only. KV and read-then-delete are not valid adapters.
  consume(input: {
    digest: string;
    ownerSessionId: string;
    now: number;
  }): Promise<boolean>;
}

async function digestState(state: string): Promise<string> {
  return encodeBase64url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state)),
    ),
  );
}

export async function createOAuthAttempt(ownerSessionId: string, now: number) {
  if (
    !ownerSessionId ||
    ownerSessionId.length > 1024 ||
    !Number.isSafeInteger(now) ||
    now < 0
  )
    throw new Error("Invalid OAuth attempt context");
  const state = encodeBase64url(crypto.getRandomValues(new Uint8Array(32)));
  return {
    state,
    record: {
      digest: await digestState(state),
      ownerSessionId,
      expiresAt: now + stateLifetimeMs,
    },
  };
}

export async function consumeOAuthState(
  state: string | null,
  ownerSessionId: string,
  now: number,
  store: OAuthStateStore,
): Promise<boolean> {
  if (
    !state ||
    !/^[A-Za-z0-9_-]{43}$/.test(state) ||
    !ownerSessionId ||
    ownerSessionId.length > 1024 ||
    !Number.isSafeInteger(now) ||
    now < 0
  )
    return false;
  return store.consume({
    digest: await digestState(state),
    ownerSessionId,
    now,
  });
}
