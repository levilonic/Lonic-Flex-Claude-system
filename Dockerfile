# Multi-stage build for optimal image size
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Remove dev dependencies and unnecessary files
RUN rm -rf tests/ docs/ .git/ .github/ *.md

# Production image
FROM node:18-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S lonicflex -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=lonicflex:nodejs /app ./

# Create necessary directories
RUN mkdir -p logs backups security-reports uploads && \
    chown -R lonicflex:nodejs logs backups security-reports uploads

# Install sqlite3 and other runtime dependencies
RUN apk add --no-cache sqlite

# Switch to non-root user
USER lonicflex

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "const http = require('http'); \
    const req = http.request('http://localhost:3000/health', (res) => { \
        process.exit(res.statusCode === 200 ? 0 : 1); \
    }); \
    req.on('error', () => process.exit(1)); \
    req.end();"

# Default command
CMD ["npm", "start"]

# Labels for metadata
LABEL org.opencontainers.image.title="LonicFLex Multi-Agent System"
LABEL org.opencontainers.image.description="12-Factor Agents methodology with live multi-agent infrastructure"
LABEL org.opencontainers.image.vendor="LonicFLex"
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL org.opencontainers.image.version="1.0.0"