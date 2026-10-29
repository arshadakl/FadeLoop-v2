import { describe, expect, it } from "vitest";
import ingress from "./index";

describe("unimplemented ingress safety", () => {
  it("does not acknowledge a webhook before verification and enqueue exist", async () => {
    const response = ingress.fetch(
      new Request("https://local.test/webhook", { method: "POST", body: "{}" }),
      { APP_ENV: "test" },
    );
    expect(response.status).toBe(503);
  });
  it("does not accidentally accept subscription challenges", () => {
    expect(
      ingress.fetch(
        new Request("https://local.test/webhook?hub.challenge=123"),
        { APP_ENV: "test" },
      ).status,
    ).toBe(503);
  });
});
