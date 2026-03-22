// Mock roles data
let roles = [
  {
    id: 1,
    name: 'ADMIN',
    description: 'Full system administrator access',
    active: true,
    isAdmin: true,
    permissions: [
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
    ],
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
  },
  {
    id: 2,
    name: 'USER',
    description: 'Standard read-only user',
    active: true,
    isAdmin: false,
    permissions: [
      { id: 1, resource: 'admin.users', action: 'read', permissionString: 'admin.users:read' },
    ],
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
  },
  {
    id: 3,
    name: 'MANAGER',
    description: 'Manager with user management access',
    active: true,
    isAdmin: false,
    permissions: [
      { id: 1, resource: 'admin.users', action: 'read', permissionString: 'admin.users:read' },
      { id: 2, resource: 'admin.users', action: 'create', permissionString: 'admin.users:create' },
      { id: 3, resource: 'admin.users', action: 'update', permissionString: 'admin.users:update' },
    ],
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-10T10:00:00Z',
  },
];

let nextId = 4;

function getAll() {
  return { success: true, data: roles };
}

function getById(id) {
  const role = roles.find(r => r.id === Number(id));
  if (!role) return null;
  return { success: true, data: role };
}

function create(data) {
  const role = {
    id: nextId++,
    name: data.name,
    description: data.description || null,
    active: true,
    isAdmin: data.isAdmin || false,
    permissions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  roles.push(role);
  return { success: true, data: role };
}

function update(id, data) {
  const idx = roles.findIndex(r => r.id === Number(id));
  if (idx === -1) return null;
  roles[idx] = { ...roles[idx], ...data, updatedAt: new Date().toISOString() };
  return { success: true, data: roles[idx] };
}

function remove(id) {
  const idx = roles.findIndex(r => r.id === Number(id));
  if (idx === -1) return false;
  roles.splice(idx, 1);
  return true;
}

module.exports = { getAll, getById, create, update, remove };
