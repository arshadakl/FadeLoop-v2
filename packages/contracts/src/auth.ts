import * as z from "zod/mini";

export const loginInputSchema = z.strictObject({
  email: z.email().check(z.maxLength(254)),
  password: z
    .string()
    .check(z.minLength(1, { error: "Enter your password" }), z.maxLength(1024)),
});
export type LoginInput = z.infer<typeof loginInputSchema>;
export const loginResultSchema = z.strictObject({
  workspaceId: z.string().check(z.minLength(1)),
  expiresAt: z.int().check(z.positive()),
});
export const ownerSessionSchema = z.extend(loginResultSchema, {
  ownerId: z.string().check(z.minLength(1)),
});
