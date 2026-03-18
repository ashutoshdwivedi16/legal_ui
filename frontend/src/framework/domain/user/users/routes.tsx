import { lazy } from 'react'
import type { RouteConfig } from '@core/navigation/types'

const UsersPage = lazy(() => import('./pages/UsersPage'))
const UserForm = lazy(() => import('./pages/UserForm'))

const routes: RouteConfig[] = [
  {
    path: '/user/users',
    element: <UsersPage />,
    permissions: ['admin.users:read'],
  },
  {
    path: '/user/users/new',
    element: <UserForm />,
    permissions: ['admin.users:create'],
  },
  {
    path: '/user/users/:id',
    element: <UserForm />,
    permissions: ['admin.users:update'],
  },
]

export default routes
