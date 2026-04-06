import type { Job } from "bullmq";
import { Worker } from "bullmq";
import type { Redis } from "ioredis";
import { EmailJobQueue } from "../EmailJobQueue.js";
import type { EmailSendPayload } from "../EmailJobQueue.js";

export async function processEmailJob(
  payload: EmailSendPayload,
): Promise<void> {
  console.log(
    `[worker] processed email to=${payload.to} subject=${payload.subject}`,
  );

  await new Promise((resolve) => setTimeout(resolve, 3000));
}

export type EmailJobProcessedHandler = (
  payload: EmailSendPayload,
) => void | Promise<void>;

export class EmailJobWorker {
  private readonly worker: Worker;

  constructor(connection: Redis, onProcessed: EmailJobProcessedHandler) {
    this.worker = new Worker(
      EmailJobQueue.queueName,
      (job) => this.processJob(job, onProcessed),
      {
        connection,
        concurrency: 500,
        limiter: {
          max: 300,
          duration: 1000,
        },
        stalledInterval: 1000,
        maxStalledCount: 3,
      },
    );
  }

  private async processJob(
    job: Job,
    onProcessed: EmailJobProcessedHandler,
  ): Promise<void> {
    if (job.name !== EmailJobQueue.jobNames.sendEmail) {
      throw new Error(`Unknown job name: ${job.name}`);
    }
    const data = job.data as EmailSendPayload;
    await Promise.resolve(onProcessed(data));
  }

  /** Raw BullMQ worker (e.g. for `failed` / `completed` listeners). */
  get bullWorker(): Worker {
    return this.worker;
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
