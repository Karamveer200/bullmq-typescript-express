import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { Application } from "express";
import { createApp } from "../../src/server.js";
import { EmailQueues } from "../../src/bullmq/queues/EmailQueues.js";
import { BullMqRedisFactory } from "../../src/bullmq/BullMqRedisFactory.js";

export type TestEmailApiServer = {
  baseUrl: string;
  server: Server;
  emailQueues: EmailQueues;
  /** Closes {@link EmailQueues} and the HTTP server. */
  close: () => Promise<void>;
};

function listenLocalhost(app: Application): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
}

/**
 * Starts {@link createApp} on an ephemeral `127.0.0.1` port with a new {@link EmailQueues}
 * using {@link BullMqRedisFactory#createConnection}. Pass the same `factory` you use for
 * workers / {@link EmailJobQueueEvents} so Redis stays consistent.
 */
export async function startTestEmailApiServer(
  factory: BullMqRedisFactory,
): Promise<TestEmailApiServer> {
  const emailQueues = new EmailQueues(factory.createConnection());
  const app = createApp({ emailQueues });
  const server = await listenLocalhost(app);
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  async function close(): Promise<void> {
    await emailQueues.close();
    await new Promise<void>((resolve, reject) => {
      server.closeAllConnections?.();
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  return { baseUrl, server, emailQueues, close };
}
