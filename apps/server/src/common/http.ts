export function apiError(code: string, status: number): Response {
  return Response.json(
    { error: { code } },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function boundedJSON(
  message: Pick<Request, "body">,
  maximumBytes: number,
): Promise<unknown> {
  const reader = message.body?.getReader();
  if (!reader) throw new Error("Missing JSON body");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new Error("JSON body too large");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally {
    reader.releaseLock();
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
