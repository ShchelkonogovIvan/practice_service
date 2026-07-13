FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate

FROM base AS deps
COPY apps/backend/package.json apps/backend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile=false

FROM deps AS build
COPY apps/backend ./
RUN pnpm exec prisma generate --schema prisma/schema.prisma
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/templates ./templates
EXPOSE 4000
CMD ["node", "dist/server.js"]

