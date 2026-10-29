export const instagramScopes = [
  "instagram_business_basic",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
] as const;

const required = [
  "META_APP_ID",
  "META_APP_SECRET",
  "META_WEBHOOK_SIGNING_SECRET",
  "META_GRAPH_VERSION",
  "META_REDIRECT_URI",
  "META_WEBHOOK_VERIFY_TOKEN",
  "TOKEN_ENCRYPTION_KEY",
] as const;
export type MetaEnvironment = Partial<
  Record<(typeof required)[number], string>
>;

export function resolveMetaEnvironment(
  env: Record<string, string | undefined>,
): MetaEnvironment {
  // Legacy FadeLoop uses the Instagram app secret for both OAuth and webhook HMAC.
  // An explicit signing-secret binding can override that migration mapping.
  return {
    META_APP_ID: env.META_APP_ID ?? env.APP_ID ?? "",
    META_APP_SECRET: env.META_APP_SECRET ?? env.APP_SECRET ?? "",
    META_WEBHOOK_VERIFY_TOKEN:
      env.META_WEBHOOK_VERIFY_TOKEN ?? env.WEBHOOK_VERIFY_TOKEN ?? "",
    META_WEBHOOK_SIGNING_SECRET:
      env.META_WEBHOOK_SIGNING_SECRET ??
      env.META_APP_SECRET ??
      env.APP_SECRET ??
      "",
    META_GRAPH_VERSION: env.META_GRAPH_VERSION ?? "",
    META_REDIRECT_URI: env.META_REDIRECT_URI ?? "",
    TOKEN_ENCRYPTION_KEY: env.TOKEN_ENCRYPTION_KEY ?? "",
  };
}

export function checkMetaConfiguration(env: MetaEnvironment): string[] {
  const issues: string[] = [];
  for (const name of required) {
    const value = env[name];
    if (
      !value ||
      value.trim() !== value ||
      value.includes("<") ||
      value.includes("REPLACE_")
    )
      issues.push(`${name}: missing or placeholder value`);
  }
  if (env.META_APP_ID && !/^\d+$/.test(env.META_APP_ID))
    issues.push("META_APP_ID: expected numeric Instagram app ID");
  if (env.META_GRAPH_VERSION && !/^v\d+\.0$/.test(env.META_GRAPH_VERSION))
    issues.push(
      "META_GRAPH_VERSION: expected explicit vN.0; support must be verified with Meta",
    );
  if (env.META_REDIRECT_URI) {
    try {
      const url = new URL(env.META_REDIRECT_URI);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.hash ||
        url.search
      )
        issues.push(
          "META_REDIRECT_URI: expected HTTPS callback without credentials, query, or fragment",
        );
    } catch {
      issues.push("META_REDIRECT_URI: invalid URL");
    }
  }
  if (
    env.TOKEN_ENCRYPTION_KEY &&
    !/^[A-Za-z0-9_-]{43}$/.test(env.TOKEN_ENCRYPTION_KEY)
  )
    issues.push("TOKEN_ENCRYPTION_KEY: expected base64url-encoded 32-byte key");
  return issues;
}
