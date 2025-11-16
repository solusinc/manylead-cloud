-- docker/postgres/init.sql
-- PostgreSQL + TimescaleDB initialization script for Manylead Cloud
--
-- This script runs automatically on the database created by POSTGRES_DB env variable
-- The Docker entrypoint creates the database before executing this script

-- Enable TimescaleDB extension for time-series data and automatic partitioning
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Enable pg_cron extension for scheduled jobs
-- NOTE: pg_cron can only be created in ONE database (cron.database_name)
-- For tenant-specific jobs, use pg_cron here and dblink to tenant databases
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pgvector extension for AI embeddings and vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable dblink for cross-database queries (needed for pg_cron + tenants)
CREATE EXTENSION IF NOT EXISTS dblink;
