INSERT INTO permissions (permission_string, resource, action) VALUES
    ('admin.audit-logs:read', 'admin.audit-logs', 'read');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'ADMIN' AND p.permission_string = 'admin.audit-logs:read';
