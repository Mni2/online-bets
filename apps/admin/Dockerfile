FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY packages packages
COPY apps apps
RUN npm install --workspaces --include-workspace-root

FROM node:20-alpine AS build
WORKDIR /repo
COPY --from=deps /repo /repo
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run -w @nova/admin build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /repo/apps/admin/dist /usr/share/nginx/html
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
