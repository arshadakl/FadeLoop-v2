import type { AutomationEvent } from "@fadeloop/contracts/events";
import { isConfiguredEnvironment } from "@fadeloop/worker-common/environment";
import { healthResponse, unavailable } from "@fadeloop/worker-common/http";
import { handleApiRequest } from "./api/handler";
import { processQueueMessage } from "./consumer/processor";
import type { ServerEnvironment } from "./environment";
import { handleWebhookRequest } from "./ingress/handler";

export default {
  async fetch(request: Request, env: ServerEnvironment): Promise<Response> {
    if (!isConfiguredEnvironment(env)) return unavailable();

    const url = new URL(request.url);
    const path = url.pathname;

    // 1. Health checks
    if (request.method === "GET") {
      if (path === "/health") {
        return healthResponse("server");
      }
      if (path === "/api/health") {
        return healthResponse("api");
      }
    }

    // 2. Webhook Ingress (Meta verification handshake & incoming events)
    if (path === "/webhook") {
      return handleWebhookRequest(request, env);
    }

    // 3. Creator REST API
    if (path.startsWith("/api/")) {
      return handleApiRequest(request, env);
    }

    // 4. Static Assets (Vite React Dashboard SPA)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return unavailable();
  },

  async queue(
    batch: MessageBatch<AutomationEvent>,
    env: ServerEnvironment,
  ): Promise<void> {
    // Process messages with per-message error boundary (Q-04)
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
} satisfies ExportedHandler<ServerEnvironment, AutomationEvent>;
