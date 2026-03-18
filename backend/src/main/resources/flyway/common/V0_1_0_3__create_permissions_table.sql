-- V3__create_permissions_table.sql
-- Creates the permissions table for fine-grained access control

CREATE TABLE permissions (
    id BIGSERIAL PRIMARY KEY,
    permission_string VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_permissions_permission_string ON permissions(permission_string);
CREATE INDEX idx_permissions_resource_action ON permissions(resource, action);

COMMENT ON TABLE permissions IS 'Permission definitions for attribute-based access control';
COMMENT ON COLUMN permissions.permission_string IS 'Permission in format resource:action (e.g., users:read, admin.roles:update)';
COMMENT ON COLUMN permissions.resource IS 'Resource name (e.g., users, admin.roles)';
COMMENT ON COLUMN permissions.action IS 'Action name (e.g., read, create, update, delete)';
