import { User } from 'lucide-react'
import type { MenuItem } from '../../core/navigation/types'

const menu: MenuItem = {
  id: 'profile',
  label: 'My Profile',
  icon: User,
  path: '/profile',
  order: 300,
}

export default menu
