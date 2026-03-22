// Mock permissions data
const permissions = [
  { id: 1, resource: 'admin.users', action: 'read', permissionString: 'admin.users:read' },
  { id: 2, resource: 'admin.users', action: 'create', permissionString: 'admin.users:create' },
  { id: 3, resource: 'admin.users', action: 'update', permissionString: 'admin.users:update' },
  { id: 4, resource: 'admin.users', action: 'delete', permissionString: 'admin.users:delete' },
  { id: 5, resource: 'admin.roles', action: 'read', permissionString: 'admin.roles:read' },
  { id: 6, resource: 'admin.roles', action: 'create', permissionString: 'admin.roles:create' },
  { id: 7, resource: 'admin.roles', action: 'update', permissionString: 'admin.roles:update' },
  { id: 8, resource: 'admin.roles', action: 'delete', permissionString: 'admin.roles:delete' },
  { id: 9, resource: 'admin.permissions', action: 'read', permissionString: 'admin.permissions:read' },
  { id: 10, resource: 'admin.audit-logs', action: 'read', permissionString: 'admin.audit-logs:read' },
  { id: 11, resource: 'admin.compliance', action: 'read', permissionString: 'admin.compliance:read' },
  { id: 12, resource: 'admin.compliance', action: 'create', permissionString: 'admin.compliance:create' },
  { id: 13, resource: 'admin.compliance', action: 'update', permissionString: 'admin.compliance:update' },
  { id: 14, resource: 'admin.compliance', action: 'delete', permissionString: 'admin.compliance:delete' },
];

function getAll() {
  return { success: true, data: permissions };
}

module.exports = { getAll };
