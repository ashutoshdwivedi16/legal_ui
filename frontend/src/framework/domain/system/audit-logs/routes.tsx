import { lazy } from 'react'
import type { RouteConfig } from '@core/navigation/types'

const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'))
const AuditLogDetailPage = lazy(() => import('./pages/AuditLogDetailPage'))

const routes: RouteConfig[] = [
  {
    path: '/admin/audit-logs',
    element: <AuditLogsPage />,
    permissions: ['admin.audit-logs:read'],
  },
  {
    path: '/admin/audit-logs/:id',
    element: <AuditLogDetailPage />,
    permissions: ['admin.audit-logs:read'],
  },
]

export default routes
