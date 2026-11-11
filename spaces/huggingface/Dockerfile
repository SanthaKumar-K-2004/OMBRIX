# OMBRIX MCP 2.0 Server - Hugging Face Spaces Runner
FROM node:20-alpine AS runner

WORKDIR /app

# Non-root user for security
USER node

# Copy pre-bundled zero-dependency standalone production files
COPY --chown=node:node package.json ./
COPY --chown=node:node index.js ./
COPY --chown=node:node icon.svg ./

# Hugging Face Spaces listens on port 7860
ENV PORT=7860
ENV MCP_TRANSPORT=sse
ENV NODE_ENV=production

EXPOSE 7860

CMD ["node", "index.js"]

