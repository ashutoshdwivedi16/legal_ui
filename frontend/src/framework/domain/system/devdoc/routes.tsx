import { lazy } from 'react'
import type { RouteConfig } from '@core/navigation/types'

const DevDocPage = lazy(() => import('./pages/DevDocPage'))

const routes: RouteConfig[] = [
  {
    path: '/system/devdoc',
    element: <DevDocPage />,
  },
]

export default routes
