# syntax=docker.io/docker/dockerfile:1

# Base stage for common setup
FROM node:18-alpine AS base

# Install dependencies for pnpm
RUN apk add --no-cache libc6-compat curl && \
    corepack enable && \
    corepack prepare pnpm@latest --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app

# Define ARG for build-time placeholders
# These placeholders will be hardcoded into the Next.js bundle during build
ARG NEXT_PUBLIC_API_URL_PLACEHOLDER=__NEXT_PUBLIC_API_URL_PLACEHOLDER__
ARG NEXT_PUBLIC_USER_ID_PLACEHOLDER=__NEXT_PUBLIC_USER_ID_PLACEHOLDER__

# Set these placeholders as environment variables during the build
# Next.js will pick these up and embed them into the client-side bundle
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL_PLACEHOLDER
ENV NEXT_PUBLIC_USER_ID=$NEXT_PUBLIC_USER_ID_PLACEHOLDER


COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY . .

RUN cp next.config.dev.mjs next.config.mjs
# No need to copy .env.example to .env, as we want to control via Docker env
# RUN cp .env.example .env 
RUN pnpm build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY --chown=nextjs:nodejs entrypoint.sh /home/nextjs/entrypoint.sh
# 添加这一行：使用 sed 命令移除 Windows 的回车符 (\r)
RUN sed -i 's/\r$//' /home/nextjs/entrypoint.sh
RUN chmod +x /home/nextjs/entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/home/nextjs/entrypoint.sh"]
CMD ["node", "server.js"]
