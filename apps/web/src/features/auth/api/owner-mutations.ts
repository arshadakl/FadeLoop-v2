import { type LoginInput, loginResultSchema } from "@fadeloop/contracts/auth";
import { sendJSON } from "../../../api/client";

export async function loginOwner(input: LoginInput) {
  return loginResultSchema.parse(await sendJSON("/api/login", "POST", input));
}
export async function logoutOwner() {
  await sendJSON("/api/session", "DELETE");
}
