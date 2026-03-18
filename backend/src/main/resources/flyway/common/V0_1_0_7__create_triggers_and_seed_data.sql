-- V7__create_triggers_and_seed_data.sql
-- Creates updated_at triggers and seeds default roles/permissions

-- =============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at column
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at 
    BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_permissions_updated_at 
    BEFORE UPDATE ON permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SEED DEFAULT ROLES
-- =============================================================================

INSERT INTO roles (name, description) VALUES
    ('ADMIN', 'Full system administrator with all permissions'),
    ('USER', 'Standard user with basic read permissions');

-- =============================================================================
-- SEED DEFAULT PERMISSIONS
-- =============================================================================

-- Admin module permissions
INSERT INTO permissions (permission_string, resource, action, description) VALUES
    -- Users management
    ('admin.users:read', 'admin.users', 'read', 'View users list and details'),
    ('admin.users:create', 'admin.users', 'create', 'Create new users'),
    ('admin.users:update', 'admin.users', 'update', 'Update user information'),
    ('admin.users:delete', 'admin.users', 'delete', 'Delete users'),
    
    -- Roles management
    ('admin.roles:read', 'admin.roles', 'read', 'View roles list and details'),
    ('admin.roles:create', 'admin.roles', 'create', 'Create new roles'),
    ('admin.roles:update', 'admin.roles', 'update', 'Update role information'),
    ('admin.roles:delete', 'admin.roles', 'delete', 'Delete roles'),
    
    -- Permissions management
    ('admin.permissions:read', 'admin.permissions', 'read', 'View permissions list'),
    ('admin.permissions:create', 'admin.permissions', 'create', 'Create new permissions'),
    ('admin.permissions:update', 'admin.permissions', 'update', 'Update permission information'),
    ('admin.permissions:delete', 'admin.permissions', 'delete', 'Delete permissions'),
    
    -- Audit logs
    ('admin.audit:read', 'admin.audit', 'read', 'View audit logs'),
    ('admin.audit:export', 'admin.audit', 'export', 'Export audit logs'),
    ('admin.audit:archive', 'admin.audit', 'archive', 'Archive old audit logs');

-- =============================================================================
-- ASSIGN PERMISSIONS TO ROLES
-- =============================================================================

-- ADMIN role gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'ADMIN';

-- USER role gets read-only permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'USER' 
  AND p.action = 'read';
