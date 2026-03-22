// Mock users data
let users = [
  {
    id: 1,
    externalUserId: 'ext-001',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    active: true,
    roles: [{ id: 1, name: 'ADMIN', description: 'Administrator', active: true }],
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
  },
  {
    id: 2,
    externalUserId: 'ext-002',
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    active: true,
    roles: [{ id: 2, name: 'USER', description: 'Standard User', active: true }],
    createdAt: '2024-01-15T08:30:00Z',
    updatedAt: '2024-02-10T12:00:00Z',
  },
  {
    id: 3,
    externalUserId: 'ext-003',
    email: 'jane.smith@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    active: true,
    roles: [{ id: 2, name: 'USER', description: 'Standard User', active: true }],
    createdAt: '2024-02-01T09:00:00Z',
    updatedAt: '2024-02-01T09:00:00Z',
  },
  {
    id: 4,
    externalUserId: 'ext-004',
    email: 'bob.inactive@example.com',
    firstName: 'Bob',
    lastName: 'Inactive',
    active: false,
    roles: [],
    createdAt: '2024-03-01T11:00:00Z',
    updatedAt: '2024-03-15T14:00:00Z',
  },
  {
    id: 5,
    externalUserId: 'ext-005',
    email: 'alice.manager@example.com',
    firstName: 'Alice',
    lastName: 'Manager',
    active: true,
    roles: [{ id: 3, name: 'MANAGER', description: 'Manager', active: true }],
    createdAt: '2024-03-10T10:00:00Z',
    updatedAt: '2024-03-10T10:00:00Z',
  },
];

let nextId = 6;

function getAll({ page = 0, size = 10, status = 'all', query = '', sort }) {
  let filtered = [...users];

  if (status === 'active') filtered = filtered.filter(u => u.active);
  if (status === 'inactive') filtered = filtered.filter(u => !u.active);
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      u =>
        u.email.toLowerCase().includes(q) ||
        (u.firstName || '').toLowerCase().includes(q) ||
        (u.lastName || '').toLowerCase().includes(q)
    );
  }

  if (sort) {
    const [field, dir] = sort.split(',');
    filtered.sort((a, b) => {
      const va = a[field] ?? '';
      const vb = b[field] ?? '';
      return dir === 'desc' ? vb.toString().localeCompare(va.toString()) : va.toString().localeCompare(vb.toString());
    });
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / size);
  const slice = filtered.slice(page * size, page * size + size);

  return {
    success: true,
    data: slice,
    page: {
      number: page,
      size,
      totalElements: total,
      totalPages,
      first: page === 0,
      last: page >= totalPages - 1,
    },
  };
}

function getById(id) {
  const user = users.find(u => u.id === Number(id));
  if (!user) return null;
  return { success: true, data: user };
}

function create(data) {
  const user = {
    id: nextId++,
    externalUserId: `ext-${String(nextId).padStart(3, '0')}`,
    email: data.email,
    firstName: data.firstName || null,
    lastName: data.lastName || null,
    active: true,
    roles: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  users.push(user);
  return { success: true, data: user };
}

function update(id, data) {
  const idx = users.findIndex(u => u.id === Number(id));
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...data, updatedAt: new Date().toISOString() };
  return { success: true, data: users[idx] };
}

function remove(id) {
  const idx = users.findIndex(u => u.id === Number(id));
  if (idx === -1) return false;
  users.splice(idx, 1);
  return true;
}

module.exports = { getAll, getById, create, update, remove };
