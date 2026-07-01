FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY packages packages
COPY apps apps
RUN npm install --workspaces --include-workspace-root

FROM node:20-alpine AS build
WORKDIR /repo
COPY --from=deps /repo /repo
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run -w @nova/frontend build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/frontend/.next ./.next
COPY --from=build /repo/apps/frontend/public ./public
COPY --from=build /repo/apps/frontend/package.json ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/frontend/node_modules* ./node_modules/
EXPOSE 3000
CMD ["sh", "-c", "npx next start -p 3000"]
