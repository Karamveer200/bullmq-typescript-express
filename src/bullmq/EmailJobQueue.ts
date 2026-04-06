import type { Job } from "bullmq";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";

export type EmailSendPayload = {
  to: string;
  subject: string;
};

export class EmailJobQueue {
  static readonly queueName = "email-jobs";

  static readonly jobNames = {
    sendEmail: "send-email",
  } as const;

  private readonly queue: Queue;

  constructor(connection: Redis) {
    this.queue = new Queue(EmailJobQueue.queueName, { connection });
  }

  /** Underlying BullMQ queue (e.g. for tests or advanced use). */
  get bullQueue(): Queue {
    return this.queue;
  }

  async enqueueSendEmail(
    payload: EmailSendPayload,
  ): Promise<Job<EmailSendPayload>> {
    return this.queue.add(EmailJobQueue.jobNames.sendEmail, payload, {
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
