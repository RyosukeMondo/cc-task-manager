-- CC Task Manager Database Initialization
-- This script runs automatically when the PostgreSQL container starts for the first time

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE cc_task_manager TO "user";

-- You can add additional initialization SQL here
-- For example, creating additional databases for testing:
-- CREATE DATABASE cc_task_manager_test;
-- GRANT ALL PRIVILEGES ON DATABASE cc_task_manager_test TO "user";

\echo 'Database initialization complete!'