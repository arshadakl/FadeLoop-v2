import { ownerSessionSchema } from "@fadeloop/contracts/auth";
import { APIError, getJSON } from "../../../api/client";

export const ownerKeys = { session: ["auth", "session"] as const };

export async function getOwnerSession(signal: AbortSignal) {
  try {
    return ownerSessionSchema.parse(await getJSON("/api/session", signal));
  } catch (error) {
    if (error instanceof APIError && error.status === 401) return null;
    throw error;
  }
}
