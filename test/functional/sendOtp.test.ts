import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { Redis } from "ioredis";
import { EMAIL_ACTION_TYPES } from "../../src/api/newTaskSchema.js";
import { BullMqRedisFactory } from "../../src/bullmq/BullMqRedisFactory.js";
import { EMAIL_QUEUE_NAMES } from "../../src/bullmq/config/emailJobConfig.js";
import {
  AuthEmailJobWorker,
  EmailJobProcessor,
} from "../../src/bullmq/worker/EmailWorkers.js";
import { createMailTransport } from "../../src/services/createMailTransport.js";
import { EmailJobQueueEvents } from "../setup/EmailJobQueueEvents.js";
import { startTestEmailApiServer } from "../setup/testEmailApiServer.js";

/**
 * Enqueues OTP via `POST /api/new-task` and processes the **auth** queue in-process with SendGrid.
 *
 * Env (e.g. `npm run test:send-otp` with `--env-file=.env`):
 * - `SENDGRID_API_KEY`, `MAIL_FROM`, `TEST_OTP_RECIPIENT`
 * Optional: `TEST_OTP_CODE`, `TEST_OTP_LINK` (valid URL)
 *
 * `npm test` skips when required vars are unset.
 */

describe("functional: real OTP email via API + auth worker (SendGrid)", () => {
  let baseUrl: string;
  let queueEvents: EmailJobQueueEvents;
  let closeApi: () => Promise<void>;
  let eventsRedis: Redis;
  let worker: AuthEmailJobWorker;
  const factory = new BullMqRedisFactory();

  before(async () => {
    const mail = createMailTransport();
    const processor = new EmailJobProcessor({ mail });

    eventsRedis = factory.createConnection();
    queueEvents = new EmailJobQueueEvents(eventsRedis, EMAIL_QUEUE_NAMES.auth);
    await queueEvents.waitUntilReady();

    const api = await startTestEmailApiServer(factory);
    baseUrl = api.baseUrl;
    closeApi = api.close;

    worker = new AuthEmailJobWorker(factory.createConnection(), (p) =>
      processor.process(p),
    );
  });

  after(async () => {
    await worker.close();
    await queueEvents.close();
    await closeApi();
    await eventsRedis.quit();
  });

  test("POST /api/new-task send-otp completes and sends mail", async () => {
    const bull = queueEvents.bullQueueEvents;
    const completed = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              "timed out waiting for auth queue job (Redis up? SendGrid slow?)",
            ),
          ),
        60_000,
      );
      const onCompleted = ({ jobId }: { jobId: string }) => {
        clearTimeout(timer);
        bull.off("completed", onCompleted);
        resolve(jobId);
      };
      bull.on("completed", onCompleted);
    });

    const otp = "482910";
    const link = "https://example.com/verify?otp-test=1";

    const res = await fetch(`${baseUrl}/api/new-task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action_type: EMAIL_ACTION_TYPES.sendOtp,
        to: "email@gmail.com",
        otp,
        link,
      }),
    });

    const responseText = await res.text();

    assert.equal(res.status, 202);

    const body = JSON.parse(responseText) as { id: string; status: string };
    assert.equal(body.status, "queued");
    assert.ok(body.id);

    const finishedId = await completed;
    assert.equal(String(finishedId), String(body.id));
  });
});
