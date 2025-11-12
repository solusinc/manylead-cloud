# syntax=docker/dockerfile:1.11
# Manylead Worker - BullMQ job processor

# Stage 1: Build
FROM oven/bun:1.3.0 AS build
WORKDIR /app
ENV NODE_ENV="production"

# Copy all source files
COPY . .

# Install dependencies and build
RUN bun install --production --ignore-scripts && \
    cd apps/worker && \
    bun build --compile --sourcemap src/index.ts --outfile=worker

# Stage 3: Runtime
FROM debian:bullseye-slim AS runtime

# Copy compiled binary
COPY \
    --from=build \
    --chown=1000:1000 \
    --chmod=555 \
    --link \
    "/app/apps/worker/worker" "/bin/"

# Copy tenant migrations (required for drizzle migrator)
COPY \
    --from=build \
    --chown=1000:1000 \
    --link \
    "/app/packages/tenant-db/drizzle" "/app/packages/tenant-db/drizzle"

USER 1000:1000
ENTRYPOINT ["/bin/worker"]
