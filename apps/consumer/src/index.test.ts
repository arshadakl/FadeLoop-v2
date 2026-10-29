import { expect, it, vi } from "vitest";
import consumer from "./index";

it("does not discard unexpected work while the consumer is disabled", () => {
  const retry = vi.fn();
  const ack = vi.fn();
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  consumer.queue({
    messages: [{ retry, ack }],
  } as unknown as MessageBatch<unknown>);
  expect(retry).toHaveBeenCalledWith({ delaySeconds: 300 });
  expect(ack).not.toHaveBeenCalled();
  log.mockRestore();
});
