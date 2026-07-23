FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY apps ./apps
RUN mkdir -p apps/frontend/public
RUN pnpm --filter @practice/backend exec prisma generate --schema prisma/schema.prisma
RUN pnpm --filter @practice/backend build
RUN pnpm --filter @practice/frontend build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=4000
ENV FRONTEND_PORT=3000
ENV NEXT_PUBLIC_API_URL=/api
ENV BACKEND_INTERNAL_URL=http://127.0.0.1:4000
ENV TEMPLATES_DIR=/app/templates
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=build /app/apps/backend/templates ./templates
COPY --from=build /app/apps/frontend/node_modules ./apps/frontend/node_modules
COPY --from=build /app/apps/frontend/package.json ./apps/frontend/package.json
COPY --from=build /app/apps/frontend/.next ./apps/frontend/.next
COPY --from=build /app/apps/frontend/public ./apps/frontend/public
EXPOSE 3000 4000
CMD ["sh", "-c", "cd /app/apps/backend && node node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma && if [ -n \"$ADMIN_EMAIL\" ] && [ -n \"$ADMIN_PASSWORD\" ]; then node dist/scripts/create-admin.js; fi && node dist/server.js & cd /app/apps/frontend && exec node node_modules/next/dist/bin/next start -p ${FRONTEND_PORT}"]
