# syntax=docker/dockerfile:1.11
# Manylead Server - Hono + Socket.io + BullMQ

# Stage 1: Build
FROM oven/bun:1.3.0 AS build
WORKDIR /app
ENV NODE_ENV="production"

# Copy all source files
COPY . .

# Install dependencies and build
RUN bun install --production --ignore-scripts && \
    cd apps/server && \
    bun build --compile --sourcemap src/index.ts --outfile=server

# Stage 3: Runtime
FROM debian:bullseye-slim AS runtime
COPY \
    --from=build \
    --chown=1000:1000 \
    --chmod=555 \
    --link \
    "/app/apps/server/server" "/bin/"
USER 1000:1000
EXPOSE 3002 3003
ENTRYPOINT ["/bin/server"]
