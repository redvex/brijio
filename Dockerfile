# ─── BrowserBridge Combined Image ────────────────────────────────────────────
# Single image running both the WebSocket companion and MCP server under s6-overlay.
# Uses the bundled dist/ output from tsup (same as the published npm package).
#
# Usage:
#   docker build -t redvex/browserbridge:0.1.1 .
#   docker run -p 8787:8787 -p 8788:8788 redvex/browserbridge:0.1.1
#
# Environment variables with defaults:
#   WEBSOCKET_HOST            — default 0.0.0.0
#   WEBSOCKET_PORT            — default 8787
#   BROWSERBRIDGE_PAIRING_TOKEN — auto-generated if empty
#   MCP_HTTP_HOST             — default 0.0.0.0
#   MCP_HTTP_PORT             — default 8788
#   MCP_HTTP_PATH             — default /mcp
#   MCP_HTTP_AUTH_TOKEN       — auto-generated if empty
#   BROWSERBRIDGE_WEBSOCKET_URL — default ws://127.0.0.1:8787
#   BROWSERBRIDGE_REQUEST_TIMEOUT_MS — default 5000
#
# Auto-generated tokens are printed to stdout on first startup.
# Persist them by setting the env vars explicitly.

# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY servers/mcp/package.json servers/mcp/package.json
COPY servers/websocket/package.json servers/websocket/package.json

RUN pnpm install --filter @redvex/browserbridge... --frozen-lockfile

COPY packages/shared packages/shared
COPY servers/mcp servers/mcp
COPY servers/websocket servers/websocket

# Build the bundled dist/ output
RUN pnpm --filter @redvex/browserbridge build

# ─── Stage 2: Runtime with s6-overlay ────────────────────────────────────────
FROM node:22-alpine AS runtime

# s6-overlay version — v3 series for Alpine
ARG S6_OVERLAY_VERSION=3.2.0.2
ARG TARGETARCH

# Install s6-overlay (noarch + arch-specific)
RUN apk add --no-cache curl \
    && curl -fsSL -o /tmp/s6-overlay-noarch.tar.xz \
       "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz" \
    && tar -C / -xf /tmp/s6-overlay-noarch.tar.xz \
    && S6_ARCH="${TARGETARCH/amd64/x86_64}" \
    && S6_ARCH="${S6_ARCH/arm64/aarch64}" \
    && curl -fsSL -o /tmp/s6-overlay-arch.tar.xz \
       "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-${S6_ARCH}.tar.xz" \
    && tar -C / -xf /tmp/s6-overlay-arch.tar.xz \
    && rm -f /tmp/s6-overlay-*.tar.xz \
    && apk del curl

WORKDIR /app

# Copy the bundled dist/ output
COPY --from=builder /app/servers/mcp/dist /app/dist
COPY --from=builder /app/servers/mcp/package.json /app/package.json

# Install only production dependencies.
# tsup bundled all workspace:* deps into dist/, but ws, zod, and
# @modelcontextprotocol/sdk remain external npm packages.
# We strip workspace:* from package.json first since npm doesn't understand it.
RUN node -e "const pkg=require('./package.json');const s=d=>{if(!d)return;for(const k of Object.keys(d)){if(d[k].startsWith('workspace:'))delete d[k];}};s(pkg.dependencies);s(pkg.devDependencies);s(pkg.peerDependencies);require('fs').writeFileSync('./package.json',JSON.stringify(pkg,null,2));" && npm install --omit=dev --ignore-scripts

# Copy s6 service definitions
COPY docker/s6-rc.d /etc/s6-overlay/s6-rc.d/
RUN chmod +x /etc/s6-overlay/s6-rc.d/browserbridge/run

# Default environment — tokens auto-generate if empty
ENV WEBSOCKET_HOST=0.0.0.0 \
    WEBSOCKET_PORT=8787 \
    MCP_HTTP_HOST=0.0.0.0 \
    MCP_HTTP_PORT=8788 \
    MCP_HTTP_PATH=/mcp \
    BROWSERBRIDGE_WEBSOCKET_URL=ws://127.0.0.1:8787 \
    BROWSERBRIDGE_REQUEST_TIMEOUT_MS=5000

EXPOSE 8787 8788

ENTRYPOINT ["/init"]
