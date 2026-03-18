import type { MenuItem } from '@core/navigation/types';

const menu: MenuItem = {
  id: 'sample/sub-menu/items',
  label: 'Items',
  path: '/sample/sub-menu/items',
  order: 1,
  permissions: ['sample:read'],
};

export default menu;
