import type { Job } from "bullmq";
import { Worker } from "bullmq";
import type { Redis } from "ioredis";
import {
  EMAIL_ACTION_TYPES,
  type EmailJobPayload,
} from "../../api/newTaskSchema.js";
import type {
  MailMessage,
  MailTransport,
} from "../../services/mail/MailTransport.js";
import { escapeHtml } from "../../templates/email/htmlEscape.js";
import { renderSendOtpEmail } from "../../templates/email/sendOtp.js";
import {
  EMAIL_JOB_NAMES,
  EMAIL_QUEUE_NAMES,
} from "../config/emailJobConfig.js";
import { normalizeError } from "../../utils/helpers.js";

export type EmailJobProcessedHandler = (
  payload: EmailJobPayload,
) => void | Promise<void>;

/** Rendered job = outbound mail shape (same as {@link MailMessage}). */
export type RenderedEmail = MailMessage;

export type EmailJobProcessorOptions = {
  mail: MailTransport;
};

export class EmailJobProcessor {
  constructor(private readonly options: EmailJobProcessorOptions) {}

  render(payload: EmailJobPayload): RenderedEmail {
    switch (payload.action_type) {
      case EMAIL_ACTION_TYPES.sendOtp: {
        const body = renderSendOtpEmail({
          otp: payload.otp,
          link: payload.link,
        });
        return { to: payload.to, ...body };
      }

      case EMAIL_ACTION_TYPES.sendPlain: {
        const { subject } = payload;
        return {
          to: payload.to,
          subject,
          text: subject,
          html: `<p>${escapeHtml(subject)}</p>`,
        };
      }
      default: {
        const _exhaustive: never = payload;
        throw new Error(`Unknown action_type: ${String(_exhaustive)}`);
      }
    }
  }

  async process(payload: EmailJobPayload): Promise<void> {
    const rendered = this.render(payload);

    console.log(
      `[worker] sending email action=${payload.action_type} to=${rendered.to} subject=${rendered.subject}`,
    );

    await this.options.mail.send(rendered);
  }
}

abstract class BaseEmailWorker {
  private readonly worker: Worker;

  protected constructor(
    queueName: string,
    connection: Redis,
    onProcessed: EmailJobProcessedHandler,
  ) {
    this.worker = new Worker(
      queueName,
      (job) => this.dispatch(job, onProcessed),
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

    this.worker.on("completed", (job) => {
      console.log(`[worker:${queueName}] job completed`, job.id);
    });

    this.worker.on("failed", (job, err) => {
      console.error(
        `[worker:${queueName}] job failed ${job?.id}\n${normalizeError(err)}`,
      );
    });
  }

  private async dispatch(
    job: Job,
    onProcessed: EmailJobProcessedHandler,
  ): Promise<void> {
    if (job.name !== EMAIL_JOB_NAMES.sendEmail) {
      throw new Error(`Unknown job name: ${job.name}`);
    }

    const data = job.data as EmailJobPayload;
    await Promise.resolve(onProcessed(data));
  }

  get bullWorker(): Worker {
    return this.worker;
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}

export class AuthEmailJobWorker extends BaseEmailWorker {
  constructor(connection: Redis, onProcessed: EmailJobProcessedHandler) {
    super(EMAIL_QUEUE_NAMES.auth, connection, onProcessed);
  }
}

export class NotificationsEmailJobWorker extends BaseEmailWorker {
  constructor(connection: Redis, onProcessed: EmailJobProcessedHandler) {
    super(EMAIL_QUEUE_NAMES.notifications, connection, onProcessed);
  }
}
