// Mock audit logs data
const actions = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'VIEW'];
const resources = ['USER', 'ROLE', 'PERMISSION', 'PROJECT', 'AUDIT'];
const actors = [
  { id: 1, email: 'admin@example.com' },
  { id: 2, email: 'john.doe@example.com' },
  { id: 5, email: 'alice.manager@example.com' },
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateLog(id) {
  const actor = randomItem(actors);
  const action = randomItem(actions);
  const resource = randomItem(resources);
  const date = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
  return {
    id,
    action,
    resource,
    resourceId: Math.floor(Math.random() * 100).toString(),
    actorId: actor.id,
    actorEmail: actor.email,
    ipAddress: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    details: { before: null, after: { status: 'changed' } },
    createdAt: date.toISOString(),
  };
}

const logs = Array.from({ length: 50 }, (_, i) => generateLog(i + 1))
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

function getAll({ page = 0, size = 10, query = '', action = '', resource = '' }) {
  let filtered = [...logs];

  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      l =>
        l.actorEmail.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.resource.toLowerCase().includes(q)
    );
  }
  if (action) filtered = filtered.filter(l => l.action === action.toUpperCase());
  if (resource) filtered = filtered.filter(l => l.resource === resource.toUpperCase());

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
  const log = logs.find(l => l.id === Number(id));
  if (!log) return null;
  return { success: true, data: log };
}

module.exports = { getAll, getById };
