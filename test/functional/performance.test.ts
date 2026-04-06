import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { Server } from "node:http";
import type { Redis } from "ioredis";
import { createApp } from "../../src/server.js";

import { EmailJobQueue } from "../../src/bullmq/EmailJobQueue.js";
import type { EmailSendPayload } from "../../src/bullmq/EmailJobQueue.js";
import {
  EmailJobWorker,
  processEmailJob,
} from "../../src/bullmq/worker/EmailJobWorker.js";
import { BullMqRedisFactory } from "../../src/bullmq/BullMqRedisFactory.js";
import { EmailJobQueueEvents } from "../setup/EmailJobQueueEvents.js";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx]!;
}

/**
 * Sustained load: each wall-clock second, sends `PERF_RPS` parallel POSTs.
 * Env: `PERF_RPS`, `PERF_SECONDS` (defaults: 100, 5).
 *
 * Uses an in-process {@link EmailJobWorker} with `perfProcessEmailJob` below (override as needed).
 * Stop the Compose `worker` service so only this test consumes the queue.
 */
async function perfProcessEmailJob(payload: EmailSendPayload): Promise<void> {
  console.log(
    `[perf-worker] to=${payload.to} subject=${payload.subject}`,
  );
  await processEmailJob(payload);
}

describe("functional: API load (requests/sec)", () => {
  const rps = Math.max(1, Number(process.env.PERF_RPS ?? 100));
  const seconds = Math.max(1, Number(process.env.PERF_SECONDS ?? 5));

  let server: Server;
  let baseUrl: string;
  let queueEvents: EmailJobQueueEvents;
  let emailQueue: EmailJobQueue;
  let eventsRedis: Redis;
  let worker: EmailJobWorker;
  const factory = new BullMqRedisFactory();

  before(async () => {
    eventsRedis = factory.createConnection();
    queueEvents = new EmailJobQueueEvents(eventsRedis);
    await queueEvents.waitUntilReady();

    emailQueue = new EmailJobQueue(factory.createConnection());
    worker = new EmailJobWorker(factory.createConnection(), perfProcessEmailJob);

    const app = createApp({ emailQueue });

    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
      server.on("error", reject);
    });
    const addr = server.address();
    assert.ok(addr && typeof addr === "object");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await worker.close();
    await queueEvents.close();
    await emailQueue.close();
    await eventsRedis.quit();
    await new Promise<void>((resolve, reject) => {
      server.closeAllConnections?.();
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  test(`POST /api/new-task at ~${rps}/s for ${seconds}s`, async () => {
    const totalExpected = rps * seconds;
    const pendingIds = new Set<string>();
    let completedCount = 0;

    const bull = queueEvents.bullQueueEvents;
    const onCompleted = ({ jobId }: { jobId: string }) => {
      const id = String(jobId);
      if (pendingIds.delete(id)) {
        completedCount++;
      }
    };
    bull.on("completed", onCompleted);

    const latenciesMs: number[] = [];
    let httpFail = 0;

    const tLoad0 = performance.now();

    for (let s = 0; s < seconds; s++) {
      const tSecond0 = performance.now();
      const batch = Array.from({ length: rps }, async (__, i) => {
        const t0 = performance.now();
        const n = s * rps + i;
        try {
          const res = await fetch(`${baseUrl}/api/new-task`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: `user${n}@example.com`,
              subject: `perf-${s}-${i}`,
            }),
          });
          const dt = performance.now() - t0;
          latenciesMs.push(dt);
          if (res.status !== 202) {
            httpFail++;
            return;
          }
          const body = (await res.json()) as { id?: string };
          if (body.id != null) {
            pendingIds.add(String(body.id));
          } else {
            httpFail++;
          }
        } catch {
          httpFail++;
        }
      });
      await Promise.all(batch);
      const elapsed = performance.now() - tSecond0;
      if (elapsed < 1000) {
        await new Promise((r) => setTimeout(r, 1000 - elapsed));
      }
    }

    const loadWallMs = performance.now() - tLoad0;

    latenciesMs.sort((a, b) => a - b);
    const n = latenciesMs.length;
    const sum = latenciesMs.reduce((a, b) => a + b, 0);

    console.log(
      `[perf] rps=${rps} duration=${seconds}s total_http=${n} expected=${totalExpected} http_fail=${httpFail} wall_s=${(loadWallMs / 1000).toFixed(2)}`,
    );
    if (n > 0) {
      console.log(
        `[perf] latency_ms min=${latenciesMs[0]!.toFixed(1)} p50=${percentile(latenciesMs, 50).toFixed(1)} p95=${percentile(latenciesMs, 95).toFixed(1)} max=${latenciesMs[n - 1]!.toFixed(1)} avg=${(sum / n).toFixed(1)}`,
      );
    }

    assert.equal(
      httpFail,
      0,
      "every POST should return 202 with a job id (check Redis / API)",
    );
    assert.equal(n, totalExpected, "should record one latency per request");

    const drainTimeoutMs = Math.min(
      600_000,
      Math.max(60_000, 30_000 + totalExpected * 100),
    );
    const tDrain0 = performance.now();
    while (pendingIds.size > 0) {
      if (performance.now() - tDrain0 > drainTimeoutMs) {
        assert.fail(
          `drain timeout: ${pendingIds.size} jobs not completed (pending=${[...pendingIds].slice(0, 5).join(",")}…)`,
        );
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    bull.off("completed", onCompleted);

    console.log(
      `[perf] bullmq completed=${completedCount} drain_s=${((performance.now() - tDrain0) / 1000).toFixed(2)}`,
    );
    assert.equal(completedCount, totalExpected);
    assert.equal(pendingIds.size, 0);
  });
});
