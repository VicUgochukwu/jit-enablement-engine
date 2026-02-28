FROM node:22-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output
COPY dist/ dist/

# Create data directory (mount as volume in production)
RUN mkdir -p data

# Run as non-root user for security
RUN addgroup -g 1001 -S jit && \
    adduser -S jit -u 1001 -G jit && \
    chown -R jit:jit /app
USER jit

# Default port
EXPOSE 3456

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3456/health || exit 1

CMD ["node", "dist/server/index.js"]
