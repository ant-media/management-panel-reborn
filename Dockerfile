# AMS React Admin Panel: standalone preview image.
# Built with mocks ON so it runs without an AMS backend behind it.

# --- build stage ---
FROM node:24-alpine AS build
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# VITE_USE_MOCKS is baked in at build time (Vite inlines import.meta.env).
ENV VITE_USE_MOCKS=true
RUN pnpm build

# --- serve stage ---
FROM nginx:alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
