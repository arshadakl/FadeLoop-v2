interface Env {
  API_HOST?: string;
}

interface EventContext {
  request: Request;
  env: Env;
}

export async function onRequest(context: EventContext): Promise<Response> {
  const url = new URL(context.request.url);
  const apiHost =
    context.env.API_HOST || "https://fadeloop-api.arshadayanikkal.workers.dev";
  const targetUrl = new URL(url.pathname + url.search, apiHost);

  return fetch(new Request(targetUrl, context.request));
}
