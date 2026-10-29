import {
  isConfiguredEnvironment,
  type WorkerEnvironment,
} from "@fadeloop/worker-common/environment";
import { healthResponse, unavailable } from "@fadeloop/worker-common/http";
import { logOperational } from "@fadeloop/worker-common/logging";

export default {
  fetch(request: Request, env: WorkerEnvironment): Response {
    if (!isConfiguredEnvironment(env)) return unavailable();
    if (request.method === "GET" && new URL(request.url).pathname === "/health")
      return healthResponse("consumer");
    return unavailable();
  },
  queue(batch: MessageBatch<unknown>): void {
    // No Queue bindings are configured until P04. Misrouted work must not be discarded.
    logOperational({
      event: "consumer.disabled",
      messageCount: batch.messages.length,
    });
    for (const message of batch.messages) message.retry({ delaySeconds: 300 });
  },
} satisfies ExportedHandler<WorkerEnvironment>;
