import { FileText } from 'lucide-react'
import type { MenuItem } from '@core/navigation/types'

const menu: MenuItem = {
  id: 'system/audit-logs',
  label: 'Audit Logs',
  icon: FileText,
  path: '/admin/audit-logs',
  order: 1,
  permissions: ['admin.audit-logs:read'],
}

export default menu
