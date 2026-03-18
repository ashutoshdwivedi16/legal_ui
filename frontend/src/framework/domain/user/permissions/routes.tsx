import { lazy } from 'react'
import type { RouteConfig } from '@core/navigation/types'

const PermissionsPage = lazy(() => import('./pages/PermissionsPage'))

const routes: RouteConfig[] = [
  {
    path: '/user/permissions',
    element: <PermissionsPage />,
    permissions: ['admin.permissions:read'],
  },
]

export default routes
