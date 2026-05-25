FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY servers/mcp/package.json servers/mcp/package.json

RUN pnpm install --filter @browserbridge/mcp... --frozen-lockfile

COPY packages/shared packages/shared
COPY servers/mcp servers/mcp

CMD ["pnpm", "--filter", "@browserbridge/mcp", "exec", "tsx", "src/index.ts"]
