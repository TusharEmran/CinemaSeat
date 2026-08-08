# Build the SPA, serve the static output from nginx. No Node in the runtime.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# Baked in at build time — the API is same-origin through the proxy, so this is
# just "/api" and the frontend never learns the API host.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/.next /app/.next
COPY --from=build /app/node_modules /app/node_modules
ENV PORT=80
EXPOSE 80
CMD ["npm", "run", "start"]
