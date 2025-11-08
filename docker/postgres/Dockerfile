# docker/postgres/Dockerfile
# PostgreSQL 16 with custom extensions for Manylead Cloud
# Extensions: pg_cron, pgvector, pg_partman

FROM postgres:16

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    postgresql-server-dev-16 \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install pg_cron
RUN git clone https://github.com/citusdata/pg_cron.git /tmp/pg_cron \
    && cd /tmp/pg_cron \
    && make \
    && make install \
    && cd / \
    && rm -rf /tmp/pg_cron

# Install pgvector
RUN git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git /tmp/pgvector \
    && cd /tmp/pgvector \
    && make \
    && make install \
    && cd / \
    && rm -rf /tmp/pgvector

# Install pg_partman
RUN git clone --branch v5.2.2 https://github.com/pgpartman/pg_partman.git /tmp/pg_partman \
    && cd /tmp/pg_partman \
    && make \
    && make install \
    && cd / \
    && rm -rf /tmp/pg_partman

# Clean build dependencies to reduce image size
RUN apt-get purge -y --auto-remove build-essential git curl

# Copy custom entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/custom-entrypoint.sh
RUN chmod +x /usr/local/bin/custom-entrypoint.sh

# Copy initialization script
COPY init.sql /docker-entrypoint-initdb.d/01-extensions.sql

# Use custom entrypoint that configures pg_cron with POSTGRES_DB env variable
ENTRYPOINT ["/usr/local/bin/custom-entrypoint.sh"]
