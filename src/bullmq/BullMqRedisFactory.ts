import { Redis } from "ioredis";

/** BullMQ requires this to be `null` (not `undefined`). */
const maxRetriesPerRequest = null;

/**
 * Builds ioredis clients suitable for BullMQ (`maxRetriesPerRequest: null`).
 *
 * Reads `REDIS_URL` or `UPSTASH_REDIS_*` from the environment — see `.env.example`.
 */
export class BullMqRedisFactory {
  createConnection(): Redis {
    const url = process.env.REDIS_URL?.trim();

    if (url) {
      return new Redis(url, { maxRetriesPerRequest });
    }

    const host = process.env.UPSTASH_REDIS_ENDPOINT?.trim();
    const password = process.env.UPSTASH_REDIS_PASSWORD?.trim();

    if (host && password) {
      const port = Number(process.env.UPSTASH_REDIS_PORT ?? "6379");
      return new Redis({
        host,
        port,
        password,
        tls: {},
        maxRetriesPerRequest,
      });
    }

    throw new Error(
      "Set REDIS_URL, or UPSTASH_REDIS_ENDPOINT + UPSTASH_REDIS_PASSWORD (see .env.example)",
    );
  }
}
