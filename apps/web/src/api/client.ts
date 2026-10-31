export class APIError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

export async function getJSON<T = unknown>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    ...(signal ? { signal } : {}),
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (!response.ok)
    throw new APIError(response.status, `Request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

export async function sendJSON<T = unknown>(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method,
    ...(signal ? { signal } : {}),
    credentials: "same-origin",
    headers: { accept: "application/json", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok)
    throw new APIError(response.status, `Request failed (${response.status}).`);
  return (response.status === 204 ? null : response.json()) as Promise<T>;
}
