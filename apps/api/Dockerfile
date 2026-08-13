# Build from monorepo root:
#   docker build -f apps/api/Dockerfile -t team-admin-api .
#
# Railway service:
#   Root Directory = /
#   Dockerfile path = apps/api/Dockerfile

FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY --from=deps /app/apps/api/package.json ./apps/api/
COPY --from=deps /app/apps/web/package.json ./apps/web/
COPY --from=deps /app/packages/db/package.json ./packages/db/
COPY --from=deps /app/packages/shared/package.json ./packages/shared/
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY apps/api ./apps/api
RUN npm run build:api

FROM base AS runner
ENV NODE_ENV=production
ENV HOST=0.0.0.0
WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/packages/db ./packages/db

EXPOSE 4000
CMD ["npm", "run", "start:api"]
