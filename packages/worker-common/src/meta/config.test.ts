import { expect, it } from "vitest";
import { checkMetaConfiguration, resolveMetaEnvironment } from "./config";

it("reports variable names without exposing secret values", () => {
  const privateValue = "<private-secret-value>";
  const issues = checkMetaConfiguration({
    META_APP_SECRET: privateValue,
    META_REDIRECT_URI: "http://example.test/callback",
    META_GRAPH_VERSION: "latest",
  });
  expect(issues.length).toBeGreaterThan(0);
  expect(issues.join(" ")).not.toContain(privateValue);
  expect(issues.join(" ")).toContain("META_REDIRECT_URI");
  expect(issues.join(" ")).toContain("META_GRAPH_VERSION");
});

it("maps existing aliases using the verified legacy signing-secret contract", () => {
  const env = resolveMetaEnvironment({
    APP_ID: "123",
    APP_SECRET: "fake-secret",
    WEBHOOK_VERIFY_TOKEN: "fake-verification-token",
  });
  expect(env.META_APP_ID).toBe("123");
  expect(env.META_APP_SECRET).toBe("fake-secret");
  expect(env.META_WEBHOOK_VERIFY_TOKEN).toBe("fake-verification-token");
  expect(env.META_WEBHOOK_SIGNING_SECRET).toBe("fake-secret");
  expect(
    resolveMetaEnvironment({
      APP_SECRET: "legacy",
      META_WEBHOOK_SIGNING_SECRET: "explicit",
    }).META_WEBHOOK_SIGNING_SECRET,
  ).toBe("explicit");
  expect(
    resolveMetaEnvironment({ APP_ID: "123", META_APP_ID: "456" }).META_APP_ID,
  ).toBe("456");
});
