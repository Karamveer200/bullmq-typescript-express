import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { Redis } from "ioredis";
<<<<<<< Updated upstream:test/functional/worker.test.ts
import { createApp } from "../../src/server.js";

import { EmailJobQueue } from "../../src/bullmq/EmailJobQueue.js";
=======
import { EMAIL_QUEUE_NAMES } from "../../src/bullmq/config/emailJobConfig.js";
>>>>>>> Stashed changes:test/behavioral/worker.test.ts
import { BullMqRedisFactory } from "../../src/bullmq/BullMqRedisFactory.js";
import { EmailJobQueueEvents } from "../setup/EmailJobQueueEvents.js";
import { startTestEmailApiServer } from "../setup/testEmailApiServer.js";

/**
 * Needs Redis + Docker `worker` (worker-cli). Debugging worker code:
 * `docker compose -f dev/docker-compose.yml up` → VS Code compound "Attach: test + Docker worker"
 * (or attach **9230** first) → `npm run test:debug`. Test process uses **9229**; worker uses **9230**.
 */
describe("functional: API + external worker-cli", () => {
  let baseUrl: string;
  let queueEvents: EmailJobQueueEvents;
<<<<<<< Updated upstream:test/functional/worker.test.ts
  let emailQueue: EmailJobQueue;
=======
  let closeApi: () => Promise<void>;
>>>>>>> Stashed changes:test/behavioral/worker.test.ts
  let eventsRedis: Redis;
  const factory = new BullMqRedisFactory();

  before(async () => {
    eventsRedis = factory.createConnection();
    queueEvents = new EmailJobQueueEvents(eventsRedis);
    await queueEvents.waitUntilReady();

<<<<<<< Updated upstream:test/functional/worker.test.ts
    emailQueue = new EmailJobQueue(factory.createConnection());

    const app = createApp({ emailQueue });

    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
      server.on("error", reject);
    });
    const addr = server.address();
    assert.ok(addr && typeof addr === "object");
    baseUrl = `http://127.0.0.1:${addr.port}`;
=======
    const api = await startTestEmailApiServer(factory);
    baseUrl = api.baseUrl;
    closeApi = api.close;
>>>>>>> Stashed changes:test/behavioral/worker.test.ts
  });

  after(async () => {
    await queueEvents.close();
<<<<<<< Updated upstream:test/functional/worker.test.ts
    await emailQueue.close();
=======
    await closeApi();
>>>>>>> Stashed changes:test/behavioral/worker.test.ts
    await eventsRedis.quit();
  });

  test("POST /api/new-task is completed by worker-cli (separate process)", async () => {
    const bull = queueEvents.bullQueueEvents;
    const completed = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              "timed out — is Redis up and worker-cli running? (e.g. docker compose up)",
            ),
          ),
        30_000,
      );

      const onCompleted = ({ jobId }: { jobId: string }) => {
        clearTimeout(timer);
        bull.off("completed", onCompleted);
        resolve(jobId);
      };
      bull.on("completed", onCompleted);
    });

    const res = await fetch(`${baseUrl}/api/new-task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "user@example.com",
        subject: "Hello from functional test",
      }),
    });
    assert.equal(res.status, 202);
    const body = (await res.json()) as { id: string; status: string };
    assert.equal(body.status, "queued");
    assert.ok(body.id);

    const finishedId = await completed;
    assert.equal(String(finishedId), String(body.id));
  });
});
