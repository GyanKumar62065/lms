# --- build stage ---
FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN bun run build

# --- runtime stage ---
FROM oven/bun:1-alpine AS runtime
RUN apk add --no-cache tini && addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=build /app/dist ./dist
USER app
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
# the oven/bun image has no Node; Bun runs the compiled JS
CMD ["bun", "dist/server.js"]
