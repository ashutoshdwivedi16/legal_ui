-- V6__create_audit_logs_table.sql
-- Creates the audit logs table for tracking all system actions

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id BIGINT REFERENCES users(id),
    user_email VARCHAR(255),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(100),
    resource_id BIGINT,
    details JSONB,                    -- Detailed payload/changes (populated based on audit.detail-storage config)
    ip_address VARCHAR(45),           -- IPv6 compatible
    user_agent VARCHAR(500),
    success BOOLEAN DEFAULT TRUE NOT NULL,
    error_message TEXT,
    service_name VARCHAR(100),        -- For proxy operations
    endpoint VARCHAR(500),            -- API endpoint (for proxy operations)
    http_method VARCHAR(10),          -- HTTP method (for proxy operations)
    correlation_id VARCHAR(255)       -- Request correlation ID
);

-- Indexes for common query patterns
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_correlation_id ON audit_logs(correlation_id);
CREATE INDEX idx_audit_logs_service_name ON audit_logs(service_name);

COMMENT ON TABLE audit_logs IS 'Audit trail for all system actions (database operations and proxy calls)';
COMMENT ON COLUMN audit_logs.details IS 'JSONB payload - populated when audit.detail-storage=db, null when =file';
COMMENT ON COLUMN audit_logs.service_name IS 'Name of downstream service for proxy operations';
COMMENT ON COLUMN audit_logs.correlation_id IS 'Request correlation ID for distributed tracing';
