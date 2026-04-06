import express from "express";
import type { EmailJobQueue } from "./bullmq/EmailJobQueue.js";

export type CreateAppOptions = {
  emailQueue: EmailJobQueue;
};

export function createApp(opts: CreateAppOptions) {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/new-task", async (req, res) => {
    const { to, subject } = req.body ?? {};
    if (typeof to !== "string" || typeof subject !== "string") {
      res
        .status(400)
        .json({ error: "Expected JSON body { to: string, subject: string }" });
      return;
    }

    const job = await opts.emailQueue.enqueueSendEmail({ to, subject });
    res.status(202).json({ id: job.id, status: "queued" });
  });

  return app;
}
