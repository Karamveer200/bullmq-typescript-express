import { EmailJobQueue } from "./bullmq/EmailJobQueue.js";
import { BullMqRedisFactory } from "./bullmq/BullMqRedisFactory.js";
import { createApp } from "./server.js";

const port = Number(process.env.PORT) || 3000;

const emailQueue = new EmailJobQueue(
  new BullMqRedisFactory().createConnection(),
);

const app = createApp({ emailQueue });

app.listen(port, () => {
  console.log(`Server Started at http://127.0.0.1:${port}`);
});
