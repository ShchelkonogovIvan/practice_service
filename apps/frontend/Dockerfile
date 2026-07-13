FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate

FROM base AS deps
COPY apps/frontend/package.json apps/frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile=false

FROM deps AS build
COPY apps/frontend ./
RUN mkdir -p public
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["pnpm", "start"]
