import { unavailable } from "@fadeloop/worker-common/http";
import { verifyWebhookSignature } from "@fadeloop/worker-common/meta/signature";
import type { ServerEnvironment } from "../environment";
import { normalizeWebhookPayload } from "./normalize";

// Bounded maximum request body: 64 KB (CPU-03)
const MAX_BODY_BYTES = 65_536;

async function readBoundedBuffer(
  request: Request,
  maxBytes: number,
): Promise<ArrayBuffer | null> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) {
    return null;
  }
  const reader = request.body?.getReader();
  if (!reader) {
    return new ArrayBuffer(0);
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result.buffer as ArrayBuffer;
  } finally {
    reader.releaseLock();
  }
}

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

    console.log(
      `[Ingress] GET /webhook handshake request received. mode=${mode}, tokenMatched=${Boolean(
        token && token === env.META_WEBHOOK_VERIFY_TOKEN,
      )}`,
    );

    if (
      mode === "subscribe" &&
      env.META_WEBHOOK_VERIFY_TOKEN &&
      token === env.META_WEBHOOK_VERIFY_TOKEN &&
      challenge &&
      challenge.length <= 256 &&
      /^[a-zA-Z0-9_.-]+$/.test(challenge)
    ) {
      console.log("[Ingress] Handshake verified. Responding with challenge.");
      return new Response(challenge, {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    console.warn("[Ingress] Handshake verification rejected (403 Forbidden).");
    return new Response("Forbidden", {
      status: 403,
      headers: { "cache-control": "no-store" },
    });
  }

  // 2. POST: Inbound webhook event notifications
  if (request.method === "POST") {
    if (!env.META_WEBHOOK_SIGNING_SECRET || !env.INCOMING_EVENTS_QUEUE) {
      console.error(
        "[Ingress] Server misconfiguration: missing META_WEBHOOK_SIGNING_SECRET or INCOMING_EVENTS_QUEUE",
      );
      return unavailable();
    }

    const signature = request.headers.get("x-hub-signature-256");
    console.log(
      `[Ingress] Inbound POST /webhook. x-hub-signature-256: ${
        signature ? "present" : "missing"
      }`,
    );

    if (!signature) {
      console.warn("[Ingress] Missing x-hub-signature-256 header; rejecting.");
      return new Response("Unauthorized", { status: 401 });
    }

    // Streaming bounded raw body read (immune to chunked memory inflation)
    const rawBuffer = await readBoundedBuffer(request, MAX_BODY_BYTES);
    if (!rawBuffer) {
      console.warn("[Ingress] Request body exceeds MAX_BODY_BYTES; rejecting.");
      return new Response("Payload Too Large", { status: 413 });
    }

    // Authenticate raw body before parsing JSON or executing any queue operations
    const isValid = await verifyWebhookSignature(
      env.META_WEBHOOK_SIGNING_SECRET,
      rawBuffer,
      signature,
    );

    if (!isValid) {
      console.warn(
        "[Ingress] Signature mismatch on raw body; rejecting (401 Unauthorized).",
      );
      return new Response("Unauthorized", { status: 401 });
    }

    // Parse JSON safely
    let payload: unknown;
    try {
      const text = new TextDecoder().decode(rawBuffer);
      payload = JSON.parse(text);
    } catch {
      console.warn("[Ingress] JSON parse failed on authenticated body.");
      return new Response("Bad Request", { status: 400 });
    }

    const events = normalizeWebhookPayload(payload, Date.now());
    console.log(
      `[Ingress] Normalized ${events.length} event(s):`,
      events.map((e) => `${e.kind}:${e.providerEventKey}`).join(", "),
    );

    // Publish to Cloudflare Queue if actionable events exist
    if (events.length > 0) {
      try {
        await env.INCOMING_EVENTS_QUEUE.sendBatch(
          events.map((event) => ({ body: event })),
        );
        console.log(
          `[Ingress] Successfully enqueued ${events.length} event(s)`,
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
