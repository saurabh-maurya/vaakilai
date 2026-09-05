FROM node:20-alpine AS base

WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
# NEXT_PUBLIC_* are compiled into the bundle at build time, so they must be
# present during `npm run build`. Render passes service env vars as build args.
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_AI_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_AI_URL=$NEXT_PUBLIC_AI_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production

# Patch OS-level CVEs
RUN apk upgrade --no-cache

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000
# Render injects its own $PORT at runtime (overrides this default).
ENV PORT 3000
# Bind to all interfaces — without this, Next standalone binds to the Docker
# container hostname and Render's proxy gets a 502.
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
