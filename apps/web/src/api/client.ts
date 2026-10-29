export class APIError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

export async function getJSON(
  path: string,
  signal: AbortSignal,
): Promise<unknown> {
  const response = await fetch(path, {
    signal,
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (!response.ok)
    throw new APIError(response.status, `Request failed (${response.status}).`);
  return response.json();
}

export async function sendJSON(
  path: string,
  method: "POST" | "DELETE",
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { accept: "application/json", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok)
    throw new APIError(response.status, `Request failed (${response.status}).`);
  return response.status === 204 ? null : response.json();
}
