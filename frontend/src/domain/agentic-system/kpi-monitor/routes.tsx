import { lazy } from 'react'
import type { RouteConfig } from '@core/navigation/types'

const KpiMonitorPage = lazy(() => import('./pages/index'))

const routes: RouteConfig[] = [
  {
    path: '/agentic-system/kpi-monitor',
    element: <KpiMonitorPage />,
  },
]

export default routes
