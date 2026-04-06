# Development

Docker Compose stack: Redis, Redis Insight, HTTP API, BullMQ worker. Bind-mount is `../ → /workspace` in containers; deps live in volume `dev_node_modules`.

## Run

From repo root:

```bash
docker compose -f dev/docker-compose.yml up
```

| Service        | Port(s) | Notes                                                         |
| -------------- | ------- | ------------------------------------------------------------- |
| `redis`        | 6379    | BullMQ                                                        |
| `redisinsight` | 5540    | UI: [localhost:5540](http://localhost:5540)                   |
| `node_server`  | 3000    | `tsx watch` → `src/index.ts`                                  |
| `worker`       | 9230    | **inspect-brk**; attach before continuing (`worker-cli`)      |

Inside Compose, `REDIS_URL=redis://redis:6379`. On the host (curl, local Node, tests), use `redis://127.0.0.1:6379` while port 6379 is published.

## Redis Insight

Add database from the UI: **host `redis`**, **port `6379`** (not `127.0.0.1` — Insight runs in Docker). Example URL: `redis://redis:6379`.

## API quick check

```bash
curl -s http://localhost:3000/health
curl -s -X POST http://localhost:3000/api/new-task \
  -H "Content-Type: application/json" \
  -d '{"to":"you@example.com","subject":"Hello"}'
```

## Tests & env

- **`npm test`** — loads `.env.test`; runs `test/**/*.test.ts` (needs Redis at `REDIS_URL`, usually `127.0.0.1:6379` with Compose up).
- **`npm run test:perf`** — load test (`test/functional/performance.test.ts`). In-process worker + `perfProcessEmailJob` override in that file; stop Compose **`worker`** so the queue has one consumer. Env: **`PERF_RPS`**, **`PERF_SECONDS`**.
- **`npm run test:debug`** — **9229** = test. `worker-cli` in Docker is **9230** — use compound **"Attach: test + Docker worker"** in `.vscode/launch.json` before continuing (worker uses **inspect-brk** so it waits for attach).

Copy `.env.example` → `.env` for local non-Docker runs.

## Files

| Path                     | Purpose                          |
| ------------------------ | -------------------------------- |
| `dev/docker-compose.yml` | Stack                            |
| `dev/Dockerfile`         | Dev image (`WORKDIR /workspace`) |
| `.env.example`           | Env samples                      |
