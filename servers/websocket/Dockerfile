FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY servers/websocket/package.json servers/websocket/package.json

RUN pnpm install --filter @browserbridge/websocket... --frozen-lockfile

COPY packages/shared packages/shared
COPY servers/websocket servers/websocket

CMD ["pnpm", "--filter", "@browserbridge/websocket", "dev"]
