import { EmailJobWorker } from "./bullmq/worker/EmailJobWorker.js";
import { BullMqRedisFactory } from "./bullmq/BullMqRedisFactory.js";
<<<<<<< Updated upstream
import { processEmailJob } from "./bullmq/worker/EmailJobWorker.js";
=======
import {
  AuthEmailJobWorker,
  NotificationsEmailJobWorker,
} from "./bullmq/worker/EmailJobWorker.js";
import { EmailJobProcessor } from "./bullmq/worker/EmailWorkers.js";
import { createMailTransport } from "./services/createMailTransport.js";
>>>>>>> Stashed changes

const factory = new BullMqRedisFactory();

const worker = new EmailJobWorker(factory.createConnection(), processEmailJob);

worker.bullWorker.on("completed", (job) => {
  console.log("[worker] job completed", job.id);
});

<<<<<<< Updated upstream
worker.bullWorker.on("failed", (job, err) => {
  console.error("[worker] job failed", job?.id, err);
});
=======
const authWorker = new AuthEmailJobWorker(
  factory.createConnection(),
  (payload: EmailJobPayload) => emailJobProcessor.process(payload),
);
const notificationsWorker = new NotificationsEmailJobWorker(
  factory.createConnection(),
  (payload: EmailJobPayload) => emailJobProcessor.process(payload),
);
>>>>>>> Stashed changes

async function shutdown() {
  console.log("[worker] shutting down...");
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
