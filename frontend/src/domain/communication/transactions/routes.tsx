import { lazy } from 'react';
import type { RouteConfig } from '@core/navigation/types';

const TransactionsListPage = lazy(() => import('./pages/Transactions'));
const TransactionDetailPage = lazy(() => import('../flows/pages/EmailFlowReader'));

const routes: RouteConfig[] = [
  {
    path: '/communication/transactions',
    element: <TransactionsListPage />,
  },
  {
    path: '/communication/transactions/:flowId',
    element: <TransactionsListPage />,
  },
  {
    path: '/communication/transactions/details/:transactionId',
    element: <TransactionDetailPage />,
  },
];

export default routes;
