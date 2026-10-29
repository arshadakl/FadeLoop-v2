import type { Health } from "@fadeloop/contracts/health";

export function healthResponse(service: Health["service"]): Response {
  return Response.json(
    { service, stage: "foundation", sendingEnabled: false } satisfies Health,
    { headers: { "cache-control": "no-store" } },
  );
}

export function unavailable(): Response {
  return Response.json(
    {
      error: {
        code: "NOT_IMPLEMENTED",
        message: "This endpoint is not available yet.",
      },
    },
    { status: 503, headers: { "cache-control": "no-store" } },
  );
}
