import { lazy } from 'react';
import type { RouteConfig } from '@core/navigation/types';

const FlowsListPage = lazy(() => import('./pages/index'));
const EmailFlowBuilderPage = lazy(() => import('./pages/EmailFlowBuilder'));

const routes: RouteConfig[] = [
  {
    path: '/communication/flows',
    element: <FlowsListPage />,
  },
  {
    path: '/communication/flows/new',
    element: <EmailFlowBuilderPage />,
  },
  {
    path: '/communication/flows/:flowId',
    element: <EmailFlowBuilderPage />,
  },
];

export default routes;
