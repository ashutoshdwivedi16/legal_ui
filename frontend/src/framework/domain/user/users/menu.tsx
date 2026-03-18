import type { MenuItem } from '../../../core/navigation/types'

const menu: MenuItem = {
  id: 'user/users',
  label: 'Users',
  path: '/user/users',
  order: 1,
  permissions: ['admin.users:read'],
}

export default menu
