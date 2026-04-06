import { EmailJobWorker } from "./bullmq/worker/EmailJobWorker.js";
import { BullMqRedisFactory } from "./bullmq/BullMqRedisFactory.js";
import { processEmailJob } from "./bullmq/worker/EmailJobWorker.js";

const factory = new BullMqRedisFactory();

const worker = new EmailJobWorker(factory.createConnection(), processEmailJob);

worker.bullWorker.on("completed", (job) => {
  console.log("[worker] job completed", job.id);
});

worker.bullWorker.on("failed", (job, err) => {
  console.error("[worker] job failed", job?.id, err);
});

async function shutdown() {
  console.log("[worker] shutting down...");
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
