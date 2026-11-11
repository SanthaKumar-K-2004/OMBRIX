# OMBRIX MCP Server - Zero-Telemetry Container
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@12.5.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY scripts/ ./scripts/
RUN pnpm install
RUN node scripts/build-tools.mjs

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/packages/mcp-server/dist/index.js ./index.js
ENV NODE_ENV=production
ENTRYPOINT ["node", "index.js"]

