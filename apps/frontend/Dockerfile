FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json
RUN pnpm install --filter @practice/frontend --frozen-lockfile=false

FROM deps AS build
COPY apps/frontend apps/frontend
WORKDIR /app/apps/frontend
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/frontend/node_modules ./apps/frontend/node_modules
COPY --from=build /app/apps/frontend/.next ./apps/frontend/.next
COPY --from=build /app/apps/frontend/public ./apps/frontend/public
WORKDIR /app/apps/frontend
EXPOSE 3000
CMD ["pnpm", "start"]
