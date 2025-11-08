-- docker/postgres/init.sql
-- PostgreSQL initialization script for Manylead Cloud
--
-- This script runs automatically on the database created by POSTGRES_DB env variable
-- The Docker entrypoint creates the database before executing this script

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pgvector extension for AI embeddings and vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_partman extension for table partitioning
CREATE EXTENSION IF NOT EXISTS pg_partman;
