import { Users } from 'lucide-react'
import type { MenuItem } from '../../core/navigation/types'

const menu: MenuItem = {
  id: 'user',
  label: 'User',
  icon: Users,
  order: 100,
  permissions: ['admin.users:read', 'admin.permissions:read', 'admin.roles:read']
}

export default menu
