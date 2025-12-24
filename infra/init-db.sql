-- Initialize PostgreSQL database for CADVisor
-- This script runs automatically on first container startup

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Set timezone
SET timezone = 'UTC';

-- Create initial schema (tables will be created by Alembic migrations)
COMMENT ON DATABASE cadvisor IS 'CADVisor - Building submission validation platform';
