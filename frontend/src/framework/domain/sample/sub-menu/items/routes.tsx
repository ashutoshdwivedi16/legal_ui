import { lazy } from 'react';
import type { RouteConfig } from '@core/navigation/types';

const SampleItemsListPage = lazy(() => import('./pages/SampleItemsPage'));
const SampleItemFormPage = lazy(() => import('./pages/SampleItemForm'));

const routes: RouteConfig[] = [
  {
    path: '/sample/sub-menu/items',
    element: <SampleItemsListPage />,
    permissions: ['sample:read'],
  },
  {
    path: '/sample/sub-menu/items/new',
    element: <SampleItemFormPage />,
    permissions: ['sample:create'],
  },
  {
    path: '/sample/sub-menu/items/:id',
    element: <SampleItemFormPage />,
    permissions: ['sample:read'],
  },
];

export default routes;
