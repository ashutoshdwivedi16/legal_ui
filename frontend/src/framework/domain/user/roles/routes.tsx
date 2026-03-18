import { lazy } from 'react'
import type { RouteConfig } from '@core/navigation/types'

const RolesPage = lazy(() => import('./pages/RolesPage'))
const RoleForm = lazy(() => import('./pages/RoleForm'))

const routes: RouteConfig[] = [
  {
    path: '/user/roles',
    element: <RolesPage />,
    permissions: ['admin.roles:read'],
  },
  {
    path: '/user/roles/new',
    element: <RoleForm mode="create" />,
    permissions: ['admin.roles:create'],
  },
  {
    path: '/user/roles/:id/edit',
    element: <RoleForm mode="edit" />,
    permissions: ['admin.roles:update'],
  },
  {
    path: '/user/roles/:id/view',
    element: <RoleForm mode="view" />,
    permissions: ['admin.roles:read'],
  },
]

export default routes
