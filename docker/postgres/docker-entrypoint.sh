#!/bin/bash
set -e

# This script configures pg_cron to use the database name from POSTGRES_DB env variable
# It runs before the main PostgreSQL entrypoint

# Set default if POSTGRES_DB is not provided
POSTGRES_DB="${POSTGRES_DB:-postgres}"

# Start PostgreSQL with TimescaleDB, pg_cron enabled and performance tuning
# IMPORTANTE: cron.database_name define onde o metadata do pg_cron é armazenado
# Mas a extensão pode ser criada em qualquer database usando cron.use_background_workers=off
exec docker-entrypoint.sh postgres \
  -c shared_preload_libraries='timescaledb,pg_cron' \
  -c cron.database_name="${POSTGRES_DB}" \
  -c cron.use_background_workers=on \
  -c shared_buffers=256MB \
  -c effective_cache_size=1GB \
  -c maintenance_work_mem=64MB \
  -c checkpoint_completion_target=0.9 \
  -c wal_buffers=16MB \
  -c default_statistics_target=100 \
  -c random_page_cost=1.1 \
  -c effective_io_concurrency=200 \
  -c work_mem=4MB \
  -c min_wal_size=1GB \
  -c max_wal_size=4GB \
  -c max_worker_processes=4 \
  -c max_parallel_workers_per_gather=2 \
  -c max_parallel_workers=4 \
  -c max_parallel_maintenance_workers=2
