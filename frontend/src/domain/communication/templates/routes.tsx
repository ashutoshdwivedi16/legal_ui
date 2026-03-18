import { lazy } from 'react';
import type { RouteConfig } from '@core/navigation/types';

const TemplatesListPage = lazy(() => import('./pages/index'));
const TemplateBuilderPage = lazy(() => import('./pages/EmailTemplateBuilder'));

const routes: RouteConfig[] = [
  {
    path: '/communication/templates',
    element: <TemplatesListPage />,
  },
  {
    path: '/communication/templates/new',
    element: <TemplateBuilderPage />,
  },
  {
    path: '/communication/templates/:templateId',
    element: <TemplateBuilderPage />,
  },
];

export default routes;
