import { unavailable } from "@fadeloop/worker-common/http";
import { verifyWebhookSignature } from "@fadeloop/worker-common/meta/signature";
import type { ServerEnvironment } from "../environment";
import { normalizeWebhookPayload } from "./normalize";

// Bounded maximum request body: 64 KB
const MAX_BODY_BYTES = 65_536;

export async function handleWebhookRequest(
  request: Request,
  env: ServerEnvironment,
): Promise<Response> {
  const url = new URL(request.url);

  // 1. GET: Subscription verification handshake
  if (request.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (
      mode === "subscribe" &&
      env.META_WEBHOOK_VERIFY_TOKEN &&
      token === env.META_WEBHOOK_VERIFY_TOKEN &&
      challenge &&
      /^[a-zA-Z0-9_-]+$/.test(challenge)
    ) {
      return new Response(challenge, {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    return new Response("Forbidden", {
      status: 403,
      headers: { "cache-control": "no-store" },
    });
  }

  // 2. POST: Inbound webhook event notifications
  if (request.method === "POST") {
    if (!env.META_WEBHOOK_SIGNING_SECRET || !env.INCOMING_EVENTS_QUEUE) {
      return unavailable();
    }

    const signature = request.headers.get("x-hub-signature-256");
    if (!signature) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Bounded raw body read
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      return new Response("Payload Too Large", { status: 413 });
    }

    const rawBuffer = await request.arrayBuffer();
    if (rawBuffer.byteLength > MAX_BODY_BYTES) {
      return new Response("Payload Too Large", { status: 413 });
    }

    // Authenticate raw body before parsing JSON or executing any queue operations
    const isValid = await verifyWebhookSignature(
      env.META_WEBHOOK_SIGNING_SECRET,
      rawBuffer,
      signature,
    );

    if (!isValid) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Parse JSON safely
    let payload: unknown;
    try {
      const text = new TextDecoder().decode(rawBuffer);
      payload = JSON.parse(text);
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    const events = normalizeWebhookPayload(payload, Date.now());

    // Publish to Cloudflare Queue if actionable events exist
    if (events.length > 0) {
      try {
        await env.INCOMING_EVENTS_QUEUE.sendBatch(
          events.map((event) => ({ body: event })),
        );
      } catch (err) {
        console.error(
          "Failed to enqueue events into INCOMING_EVENTS_QUEUE:",
          err,
        );
        // Return 503 so Meta knows to retry sending this batch
        return new Response("Service Unavailable", { status: 503 });
      }
    }

    // Acknowledge receipt to Meta only after durable enqueue or if event was intentionally ignored
    return new Response("EVENT_RECEIVED", {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  return new Response("Method Not Allowed", {
    status: 405,
    headers: { allow: "GET, POST" },
  });
}
