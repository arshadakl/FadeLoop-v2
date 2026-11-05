export interface WebhookSubscriptionResult {
  success: boolean;
  subscribedFields: string[];
}

/**
 * Subscribes the connected Instagram Professional Account to the app's webhooks.
 *
 * In Meta's architecture:
 * - Setting Callback URL in App Dashboard subscribes the APP to the webhook endpoint.
 * - Calling POST /{accountId}/subscribed_apps subscribes the ACCOUNT to forward events to the app.
 * BOTH are strictly required before Meta will deliver comment or message events.
 *
 * Endpoint: POST https://graph.instagram.com/{graphVersion}/{accountId}/subscribed_apps
 * Parameters: subscribed_fields=comments,messages&access_token={token}
 */
export async function subscribeInstagramAccountToWebhooks(
  accountId: string,
  accessToken: string,
  graphVersion: string = "v23.0",
  fetcher: typeof fetch = fetch,
): Promise<WebhookSubscriptionResult> {
  const fields = "comments,messages";
  const url = new URL(
    `https://graph.instagram.com/${graphVersion}/${accountId}/subscribed_apps`,
  );
  url.searchParams.set("subscribed_fields", fields);
  url.searchParams.set("access_token", accessToken);

  const res = await fetcher(url.toString(), {
    method: "POST",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(
      `[Meta Client] Failed to subscribe account ${accountId} to webhooks: HTTP ${res.status}`,
      errorText,
    );
    throw new Error(
      `Failed to subscribe account to webhooks: HTTP ${res.status}`,
    );
  }

  const json = (await res.json()) as { success?: boolean };
  console.log(
    `[Meta Client] Successfully subscribed account ${accountId} to webhooks (${fields})`,
  );
  return {
    success: json.success ?? true,
    subscribedFields: ["comments", "messages"],
  };
}

/**
 * Reads the active webhook subscription for the connected account.
 * Endpoint: GET https://graph.instagram.com/{graphVersion}/{accountId}/subscribed_apps
 */
export async function getInstagramAccountWebhookSubscriptions(
  accountId: string,
  accessToken: string,
  graphVersion: string = "v23.0",
  fetcher: typeof fetch = fetch,
): Promise<{ subscribedFields: string[] }> {
  const url = new URL(
    `https://graph.instagram.com/${graphVersion}/${accountId}/subscribed_apps`,
  );
  url.searchParams.set("access_token", accessToken);

  const res = await fetcher(url.toString(), {
    method: "GET",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    return { subscribedFields: [] };
  }

  const json = (await res.json()) as {
    data?: Array<{ subscribed_fields?: string[] }>;
  };
  const subscribedFields =
    json.data?.flatMap((d) => d.subscribed_fields ?? []) ?? [];
  return { subscribedFields };
}
