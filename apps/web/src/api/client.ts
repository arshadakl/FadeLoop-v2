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
