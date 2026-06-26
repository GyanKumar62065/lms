# --- deps ---
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# --- build ---
FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* must be present at build time (inlined by Next.js).
# BACKEND_ORIGIN must also be present at build time — Next.js bakes rewrites() into the build,
# so the same-origin API proxy destination is resolved here (not at runtime).
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG BACKEND_ORIGIN
ENV BACKEND_ORIGIN=$BACKEND_ORIGIN
RUN bun run build

# --- runtime (standalone) ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]
