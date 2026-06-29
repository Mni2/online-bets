FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages packages
COPY apps apps
RUN npm install --workspaces --include-workspace-root

FROM node:20-alpine AS build
WORKDIR /repo
COPY --from=deps /repo /repo
ENV DATABASE_URL=postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder
RUN npx prisma generate --schema packages/database/prisma/schema.prisma
RUN npm run -w @nova/backend build

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/backend/dist ./dist
COPY --from=build /repo/apps/backend/package.json ./
COPY --from=build /repo/packages ./node_modules/../packages
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/database/prisma ./prisma
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy --schema prisma/schema.prisma && node dist/server.js"]
