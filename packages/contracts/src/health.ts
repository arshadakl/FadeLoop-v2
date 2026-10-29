import { z } from "zod";

export const healthSchema = z.strictObject({
  service: z.enum(["api", "ingress", "consumer"]),
  stage: z.literal("foundation"),
  sendingEnabled: z.literal(false),
});
export type Health = z.infer<typeof healthSchema>;
