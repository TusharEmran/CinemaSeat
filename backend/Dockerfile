# Multi-stage. The runtime image carries no compiler, no dev dependencies and no
# source — just dist/ and production node_modules.

# ── deps ──────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ── build ─────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── test ──────────────────────────────────────────────────────────────────────
# Built as its own target so CI can `docker build --target test` and run the
# suite in exactly the image it ships.
FROM build AS test
CMD ["npm", "run", "test"]

# ── prod deps ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# ── runtime ───────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Do not run as root.
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs cinema

COPY --from=prod-deps --chown=cinema:nodejs /app/node_modules ./node_modules
COPY --from=build     --chown=cinema:nodejs /app/dist ./dist
COPY --chown=cinema:nodejs package.json ./

USER cinema
EXPOSE 3000

# tini-less: node is PID 1, so main.ts installs SIGTERM/SIGINT handlers for
# graceful shutdown (stop accepting, drain in-flight, close pools).
CMD ["node", "dist/main.js"]
