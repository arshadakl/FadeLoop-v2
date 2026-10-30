import type { AutomationEvent } from "@fadeloop/contracts/events";
import {
  isConfiguredEnvironment,
  type WorkerEnvironment,
} from "@fadeloop/worker-common/environment";
import { healthResponse, unavailable } from "@fadeloop/worker-common/http";
import { type ConsumerEnvironment, processQueueMessage } from "./processor";

export interface ConsumerWorkerEnvironment
  extends WorkerEnvironment,
    ConsumerEnvironment {}

export default {
  fetch(request: Request, env: ConsumerWorkerEnvironment): Response {
    if (!isConfiguredEnvironment(env)) return unavailable();
    if (request.method === "GET" && new URL(request.url).pathname === "/health")
      return healthResponse("consumer");
    return unavailable();
  },

  async queue(
    batch: MessageBatch<AutomationEvent>,
    env: ConsumerWorkerEnvironment,
  ): Promise<void> {
    // Process messages per message (batch size 1 initially per free tier guardrail)
    for (const message of batch.messages) {
      await processQueueMessage(message, env);
    }
  },
} satisfies ExportedHandler<ConsumerWorkerEnvironment, AutomationEvent>;
