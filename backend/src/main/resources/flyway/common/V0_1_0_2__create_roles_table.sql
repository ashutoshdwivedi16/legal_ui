-- V2__create_roles_table.sql
-- Creates the roles table for RBAC

CREATE TABLE roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_roles_name ON roles(name);
CREATE INDEX idx_roles_active ON roles(active);

COMMENT ON TABLE roles IS 'Role definitions for role-based access control';
COMMENT ON COLUMN roles.name IS 'Unique role name (e.g., ADMIN, USER, MANAGER)';
