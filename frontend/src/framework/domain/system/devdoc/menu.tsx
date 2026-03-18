import { BookOpen } from 'lucide-react'
import type { MenuItem } from '@core/navigation/types'

const menu: MenuItem = {
  id: 'system/devdoc',
  label: 'Developer Docs',
  icon: BookOpen,
  path: '/system/devdoc',
  order: 10,
}

export default menu
