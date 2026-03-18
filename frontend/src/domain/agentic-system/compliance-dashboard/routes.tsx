import { lazy } from 'react'
import type { RouteConfig } from '@core/navigation/types'

const ComplianceDashboardPage = lazy(() => import('./pages/index'))

const routes: RouteConfig[] = [
  {
    path: '/agentic-system/compliance-dashboard',
    element: <ComplianceDashboardPage />,
  },
]

export default routes
