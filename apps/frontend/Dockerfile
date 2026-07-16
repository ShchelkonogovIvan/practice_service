FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
RUN pnpm install --frozen-lockfile --filter @practice/frontend...

FROM deps AS build
ARG NEXT_PUBLIC_API_URL=/api
ARG BACKEND_INTERNAL_URL=http://backend:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL
COPY apps/frontend ./apps/frontend
RUN mkdir -p apps/frontend/public
RUN pnpm --filter @practice/frontend build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app/apps/frontend
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/frontend/node_modules ./node_modules
COPY --from=build /app/apps/frontend/package.json ./package.json
COPY --from=build /app/apps/frontend/.next ./.next
COPY --from=build /app/apps/frontend/public ./public
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start"]
