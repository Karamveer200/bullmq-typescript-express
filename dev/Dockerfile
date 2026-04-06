# Development image: TypeScript via tsx with watch mode.
# Source is expected to be bind-mounted (see dev/docker-compose.yml) so edits reload the process.

FROM node:22-alpine

WORKDIR /workspace

COPY package.json package-lock.json* ./

RUN npm ci

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=development

# Docker Desktop bind mounts (Windows/macOS) often do not propagate inotify reliably; polling makes tsx watch stable.
ENV CHOKIDAR_USEPOLLING=true
ENV CHOKIDAR_INTERVAL=250

EXPOSE 3000

# Overridden per service in docker-compose (node_server vs worker).
CMD ["npx", "tsx", "watch", "--include", "src/**/*.ts", "src/index.ts"]
