-- V1__create_users_table.sql
-- Creates the users table for admin user management

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    external_user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    -- User Activity Tracking
    last_login_at TIMESTAMP,
    last_activity_at TIMESTAMP,
    login_count INTEGER DEFAULT 0 NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_users_external_user_id ON users(external_user_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(active);
CREATE INDEX idx_users_last_login_at ON users(last_login_at);
CREATE INDEX idx_users_last_activity_at ON users(last_activity_at);

COMMENT ON TABLE users IS 'Admin application users synchronized from external auth provider';
COMMENT ON COLUMN users.external_user_id IS 'User ID from external auth provider (e.g., Cognito sub claim)';
COMMENT ON COLUMN users.last_login_at IS 'Timestamp of the user''s last successful login';
COMMENT ON COLUMN users.last_activity_at IS 'Timestamp of the user''s last activity (any API request)';
COMMENT ON COLUMN users.login_count IS 'Total number of successful logins';
