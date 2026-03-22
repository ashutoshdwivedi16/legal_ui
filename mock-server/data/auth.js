// Mock auth data
const mockUsers = [
  {
    id: 1,
    email: 'admin@example.com',
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'User',
    roles: ['ROLE_ADMIN'],
    permissions: [
      'admin.users:read', 'admin.users:create', 'admin.users:update', 'admin.users:delete',
      'admin.roles:read', 'admin.roles:create', 'admin.roles:update', 'admin.roles:delete',
      'admin.permissions:read',
      'admin.audit-logs:read',
    ],
  },
  {
    id: 2,
    email: 'user@example.com',
    password: 'user123',
    firstName: 'Regular',
    lastName: 'User',
    roles: ['ROLE_USER'],
    permissions: ['admin.users:read'],
  },
];

module.exports = { mockUsers };
