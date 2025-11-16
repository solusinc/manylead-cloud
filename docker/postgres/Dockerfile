# docker/postgres/Dockerfile
# TimescaleDB 2.17 (PostgreSQL 16) with custom extensions for Manylead Cloud
# Extensions: pg_cron, pgvector, timescaledb

FROM timescale/timescaledb:latest-pg16

# Install build dependencies (Alpine uses apk, not apt-get)
RUN apk add --no-cache --virtual .build-deps \
    build-base \
    postgresql16-dev \
    clang19 \
    llvm19 \
    git \
    curl

# Install pg_cron
RUN git clone https://github.com/citusdata/pg_cron.git /tmp/pg_cron \
    && cd /tmp/pg_cron \
    && make \
    && make install \
    && cd / \
    && rm -rf /tmp/pg_cron

# Install pgvector (with proper architecture detection)
RUN git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git /tmp/pgvector \
    && cd /tmp/pgvector \
    && make clean \
    && make OPTFLAGS="" \
    && make install \
    && cd / \
    && rm -rf /tmp/pgvector

# TimescaleDB is already included in the base image
# No need to install pg_partman - TimescaleDB handles partitioning natively

# Clean build dependencies to reduce image size
RUN apk del .build-deps

# Copy custom entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/custom-entrypoint.sh
RUN chmod +x /usr/local/bin/custom-entrypoint.sh

# Copy initialization script
COPY init.sql /docker-entrypoint-initdb.d/01-extensions.sql

# Use custom entrypoint that configures pg_cron with POSTGRES_DB env variable
ENTRYPOINT ["/usr/local/bin/custom-entrypoint.sh"]
