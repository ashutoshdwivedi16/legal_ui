import { lazy } from 'react'
import type { RouteConfig } from '@core/navigation/types'

const ProfilePage = lazy(() => import('./pages/ProfilePage'))

const routes: RouteConfig[] = [
  {
    path: '/profile',
    element: <ProfilePage />,
  },
]

export default routes
