# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable && corepack prepare pnpm@11.1.1 --activate

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma
COPY apps/collab/package.json apps/collab/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
# Prisma client генерируется здесь под Linux; не копируем артефакты с macOS.
RUN pnpm --filter @noto/shared build && pnpm --filter @noto/api build

# Production runtime deliberately retains the built workspace: pnpm 11 legacy
# deploy re-resolves packages and drops Prisma's generated client. This is
# larger than an ideal deployment image but guarantees the Linux client/engine.
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]

# Отдельный образ для migrate deploy: Prisma CLI намеренно не попадает в runtime
# образ. Он публикуется как noto-api-migrate:<sha> и запускается только deploy-скриптом.
FROM build AS migration
ENV NODE_ENV=production
WORKDIR /app/apps/api
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]
