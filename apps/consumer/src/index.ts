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
    // Process messages per message with per-message error boundary
    for (const message of batch.messages) {
      try {
        await processQueueMessage(message, env);
      } catch (err) {
        console.error("Unhandled error processing queue message:", err);
        // Isolate failure to this specific message: retry with backoff, don't abort entire batch
        message.retry({ delaySeconds: 60 });
      }
    }
  },
} satisfies ExportedHandler<ConsumerWorkerEnvironment, AutomationEvent>;
