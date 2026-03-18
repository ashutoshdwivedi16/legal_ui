import type { MenuItem } from '../../../core/navigation/types'

const menu: MenuItem = {
  id: 'user/roles',
  label: 'Roles',
  path: '/user/roles',
  order: 2,
  permissions: ['admin.roles:read'],
}

export default menu
