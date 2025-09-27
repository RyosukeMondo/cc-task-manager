# Multi-stage build for production optimization
FROM node:18.17-alpine AS base

# Install pnpm
RUN npm install -g pnpm@8

# Set working directory
WORKDIR /app

# Copy package manager files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/schemas/package.json ./packages/schemas/
COPY packages/types/package.json ./packages/types/

# Dependencies stage
FROM base AS deps
RUN apk add --no-cache libc6-compat

# Install dependencies
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/frontend/node_modules ./apps/frontend/node_modules

# Copy source code
COPY . .

# Build workspace packages first
RUN pnpm --filter "@cc-task-manager/schemas" build || echo "No build script for schemas"
RUN pnpm --filter "@cc-task-manager/types" build || echo "No build script for types"

# Set build environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the frontend application
WORKDIR /app/apps/frontend
RUN pnpm build

# Production stage
FROM node:18.17-alpine AS runner

# Security: create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set working directory
WORKDIR /app

# Copy necessary files for standalone build
COPY --from=builder /app/apps/frontend/public ./public

# Set correct permissions for standalone build
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/static ./.next/static

# Create environment file placeholder
RUN touch .env.local && chown nextjs:nodejs .env.local

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').request('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).end()" || exit 1

# Start the application
CMD ["node", "server.js"]