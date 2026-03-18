import { lazy } from 'react';
import type { RouteConfig } from '@core/navigation/types';

const ReportsPage = lazy(() => import('./pages/index'));

const routes: RouteConfig[] = [
  {
    path: '/communication/reports',
    element: <ReportsPage />,
  },
];

export default routes;
