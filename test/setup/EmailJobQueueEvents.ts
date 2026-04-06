import { QueueEvents } from "bullmq";
import type { Redis } from "ioredis";
import { EmailJobQueue } from "../../src/bullmq/EmailJobQueue.js";

/** Subscribes to lifecycle events for {@link EmailJobQueue}. */
export class EmailJobQueueEvents {
  private readonly queueEvents: QueueEvents;

  constructor(connection: Redis) {
    this.queueEvents = new QueueEvents(EmailJobQueue.queueName, { connection });
  }

  get bullQueueEvents(): QueueEvents {
    return this.queueEvents;
  }

  async waitUntilReady(): Promise<void> {
    await this.queueEvents.waitUntilReady();
  }

  async close(): Promise<void> {
    await this.queueEvents.close();
  }
}
