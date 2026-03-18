# Frontend - Universal Admin Framework

Modern React-based admin interface built with Vite, TypeScript, Tailwind CSS v4, and ShadCN UI.

## Technology Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Build Tool | Vite | 7.x | Fast development server and optimized builds |
| UI Framework | React | 19+ | Component-based UI framework |
| Language | TypeScript | 5.9+ | Type-safe development |
| UI Library | ShadCN UI | Latest | Copy-paste component model, Radix UI primitives |
| Styling | Tailwind CSS | 4.x | Utility-first CSS framework (CSS-first config) |
| Animations | tw-animate-css | 1.x | Animation utilities for Tailwind v4 |
| State Management | Zustand | 5.x | Lightweight global state management |
| Server State | TanStack Query | 5.x | Server state, caching, synchronization |
| Routing | React Router | 7.x | Client-side routing |
| HTTP Client | Axios | 1.x | HTTP requests |
| Package Manager | pnpm | 10.x | Dependency management |

## Project Structure

```
src/
├── framework/                    # 🔒 FRAMEWORK TEAM (do not modify)
│   ├── core/                     # Pure infrastructure (NO routes/menu)
│   │   ├── auth/                 # Authentication (BFF pattern)
│   │   │   ├── components/       # ProtectedRoute, RequirePermission, etc.
│   │   │   ├── stores/           # authStore, permissionStore
│   │   │   └── login.ts          # Login helpers
│   │   ├── layout/               # Layout components
│   │   │   ├── MainLayout.tsx    # Main app layout with sidebar
│   │   │   └── components/       # Header, AppSidebar, Breadcrumb
│   │   ├── navigation/           # Auto-discovery engine
│   │   │   ├── moduleLoader.ts   # Menu/route discovery
│   │   │   └── types.ts          # MenuItem interface
│   │   ├── pages/                # Framework pages (Login, Home, etc.)
│   │   └── components/           # Error boundaries, Loading, etc.
│   └── domain/                   # Framework features WITH routes/menu
│       ├── user/                 # User Management module
│       │   ├── users/
│       │   ├── roles/
│       │   ├── permissions/
│       │   └── profile/
│       └── audit-logs/
├── shared/                       # 🔒 FRAMEWORK TEAM (utilities)
│   ├── components/ui/            # ShadCN components
│   ├── hooks/                    # Shared React hooks
│   ├── lib/                      # axios, query-client, utils
│   └── utils/                    # Utility functions
└── domain/                       # 🔓 DOMAIN TEAMS
    └── {service-name}/           # Each business domain module
        ├── menu.tsx              # Menu configuration
        ├── routes.tsx            # Route definitions
        ├── api/                  # API layer (TanStack Query hooks)
        ├── pages/                # Page components
        └── components/           # Module-specific components
```

## Path Aliases

| Alias | Maps To | Purpose |
|-------|---------|---------|
| `@/` | `src/` | ShadCN convention (used internally by ShadCN components) |
| `@core/` | `src/framework/core/` | Framework core (auth, layout, navigation) |
| `@shared/` | `src/shared/` | Shared UI components (ShadCN), utilities, lib |
| `@domain/` | `src/domain/` | Cross-domain imports between business modules |

**Usage Examples:**
```typescript
// Framework core imports
import { useAuthStore } from '@core/auth/stores/authStore';
import { MainLayout } from '@core/layout/MainLayout';
import { ProtectedRoute } from '@core/auth/components/ProtectedRoute';

// Shared imports
import { Button } from '@shared/components/ui/button';
import { apiClient } from '@shared/lib/api-client';
```

---

## Module Development Guide

This guide explains how to create a new domain module with menu integration, routing, and API layer.

### Step 1: Create Module Folder Structure

```bash
src/domain/{your-module}/
├── menu.tsx              # Menu configuration (required)
├── routes.tsx            # Route definitions (required)
├── api/
│   └── {resource}.api.ts # API functions + TanStack Query hooks
├── pages/
│   ├── index.tsx         # List page
│   └── {Resource}Form.tsx # Create/Edit form
└── components/           # Module-specific components (optional)
```

### Step 2: Configure Menu (`menu.tsx`)

The menu configuration determines where your module appears in the sidebar.

#### MenuItem Interface

```typescript
interface MenuItem {
  id: string;            // Hierarchical ID: 'parent/child/grandchild'
  label: string;         // Display label
  path?: string;         // Route path (leaf nodes only)
  icon?: LucideIcon;     // Icon component (typically on root parent nodes)
  order: number;         // Sort order within parent
  permissions?: string[]; // Required permissions
}
```

#### Menu ID Convention (IMPORTANT)

Menu IDs use a slash-separated format that determines parent-child relationships:

| Level | ID Format | Example |
|-------|-----------|---------|
| Root | `'parent'` | `'orders'` |
| Child | `'parent/child'` | `'orders/pending'` |
| Grandchild | `'parent/child/grandchild'` | `'orders/pending/urgent'` |

#### Example: Simple Module (Single Level)

```typescript
// src/domain/orders/menu.tsx
import { ShoppingCart } from 'lucide-react';
import type { MenuItem } from '@core/navigation/types';

export const menu: MenuItem = {
  id: 'orders',
  label: 'Orders',
  icon: ShoppingCart,
  path: '/orders',
  order: 10,
  permissions: ['orders:read'],
};
```

#### Example: Nested Module (Multi-Level)

**Root menu (parent):**
```typescript
// src/domain/sample/menu.tsx
import { Beaker } from 'lucide-react';
import type { MenuItem } from '@core/navigation/types';

export const menu: MenuItem = {
  id: 'sample',
  label: 'Sample',
  icon: Beaker,
  order: 20,
  // No path - this is a collapsible parent group
};
```

**Intermediate menu (child):**
```typescript
// src/domain/sample/sub-menu/menu.tsx
import type { MenuItem } from '@core/navigation/types';

export const menu: MenuItem = {
  id: 'sample/sub-menu',  // Parent ID + child name
  label: 'Sub-menu',
  order: 1,
  // No path - this is also a collapsible group
};
```

**Leaf menu (navigable):**
```typescript
// src/domain/sample/sub-menu/items/menu.tsx
import type { MenuItem } from '@core/navigation/types';

export const menu: MenuItem = {
  id: 'sample/sub-menu/items',  // Full hierarchical ID
  label: 'Items',
  path: '/sample/sub-menu/items',  // Has path - this is navigable
  order: 1,
  permissions: ['sample:read'],
};
```

### Step 3: Configure Routes (`routes.tsx`)

Routes must be wrapped with `ProtectedRoute` for authentication and `MainLayout` for the app shell.

```typescript
// src/domain/{module}/routes.tsx
import { Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { ProtectedRoute } from '@core/auth/components/ProtectedRoute';
import { MainLayout } from '@core/layout/MainLayout';
import { Loading } from '@core/components/Loading';

// Lazy load pages for code splitting
const ListPage = lazy(() => import('./pages'));
const FormPage = lazy(() => import('./pages/ResourceForm'));

export const routes = (
  <Route element={<ProtectedRoute />}>
    <Route element={<MainLayout />}>
      <Route
        path="/your-module"
        element={
          <Suspense fallback={<Loading />}>
            <ListPage />
          </Suspense>
        }
      />
      <Route
        path="/your-module/new"
        element={
          <Suspense fallback={<Loading />}>
            <FormPage />
          </Suspense>
        }
      />
      <Route
        path="/your-module/:id"
        element={
          <Suspense fallback={<Loading />}>
            <FormPage />
          </Suspense>
        }
      />
    </Route>
  </Route>
);
```

**Route Pattern Convention:**
| Pattern | Purpose |
|---------|---------|
| `/module` | List page |
| `/module/new` | Create form |
| `/module/:id` | Edit form (or detail view) |

### Step 4: Create API Layer (`api/{resource}.api.ts`)

Follow the TanStack Query pattern with query options and hooks.

```typescript
// src/domain/{module}/api/{resource}.api.ts
import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { apiClient } from '@shared/lib/api-client';

// Types
interface Item {
  id: number;
  name: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateItemRequest {
  name: string;
  description?: string;
  status?: string;
}

interface UpdateItemRequest {
  name?: string;
  description?: string;
  status?: string;
}

interface ListParams {
  page?: number;
  size?: number;
  sort?: string;
}

// Backend response types
interface PagedResponse<T> {
  success: boolean;
  data: T[];
  page: {
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
}

interface DataResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// API Functions
export const getItems = async (params: ListParams = {}) => {
  const response = await apiClient.get<PagedResponse<Item>>('/v1/items', { params });
  // Transform to format expected by data table
  return {
    content: response.data.data,
    totalPages: response.data.page.totalPages,
    totalElements: response.data.page.totalElements,
    number: response.data.page.number,
    size: response.data.page.size,
  };
};

export const getItem = async (id: number) => {
  const response = await apiClient.get<DataResponse<Item>>(`/v1/items/${id}`);
  return response.data.data;
};

export const createItem = async (data: CreateItemRequest) => {
  const response = await apiClient.post<DataResponse<Item>>('/v1/items', data);
  return response.data.data;
};

export const updateItem = async (id: number, data: UpdateItemRequest) => {
  const response = await apiClient.put<DataResponse<Item>>(`/v1/items/${id}`, data);
  return response.data.data;
};

export const deleteItem = async (id: number) => {
  await apiClient.delete(`/v1/items/${id}`);
};

// Query Options (reusable)
export const itemsQueryOptions = (params: ListParams = {}) =>
  queryOptions({
    queryKey: ['items', params],
    queryFn: () => getItems(params),
  });

export const itemQueryOptions = (id: number) =>
  queryOptions({
    queryKey: ['items', id],
    queryFn: () => getItem(id),
    enabled: !!id,
  });

// Hooks
export const useItems = (params: ListParams = {}) => {
  return useQuery(itemsQueryOptions(params));
};

export const useItem = (id: number) => {
  return useQuery(itemQueryOptions(id));
};

export const useCreateItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
};

export const useUpdateItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateItemRequest }) =>
      updateItem(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['items', variables.id] });
    },
  });
};

export const useDeleteItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
};
```

### Step 5: Create Pages

#### List Page (`pages/index.tsx`)

```typescript
// src/domain/{module}/pages/index.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { DataTable } from '@shared/components/ui/data-table';
import { useItems, useDeleteItem } from '../api/items.api';
import { useToast } from '@shared/hooks/use-toast';

export default function ItemsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);

  const { data, isLoading } = useItems({ page, size });
  const deleteMutation = useDeleteItem();

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'Success', description: 'Item deleted successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete item', variant: 'destructive' });
    }
  };

  const columns = [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'status', header: 'Status' },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/items/${row.original.id}`)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(row.original.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Items</h1>
        <Button onClick={() => navigate('/items/new')}>
          <Plus className="mr-2 h-4 w-4" /> New Item
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.content ?? []}
        isLoading={isLoading}
        pagination={{
          pageIndex: page,
          pageSize: size,
          pageCount: data?.totalPages ?? 0,
          onPageChange: setPage,
          onPageSizeChange: setSize,
        }}
      />
    </div>
  );
}
```

#### Form Page (`pages/ItemForm.tsx`)

```typescript
// src/domain/{module}/pages/ItemForm.tsx
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/components/ui/form';
import { useItem, useCreateItem, useUpdateItem } from '../api/items.api';
import { useToast } from '@shared/hooks/use-toast';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  status: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ItemForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const isEdit = Boolean(id);

  const { data: item, isLoading } = useItem(Number(id));
  const createMutation = useCreateItem();
  const updateMutation = useUpdateItem();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      status: 'ACTIVE',
    },
  });

  useEffect(() => {
    if (item) {
      form.reset({
        name: item.name,
        description: item.description ?? '',
        status: item.status,
      });
    }
  }, [item, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: Number(id), data: values });
        toast({ title: 'Success', description: 'Item updated successfully' });
      } else {
        await createMutation.mutateAsync(values);
        toast({ title: 'Success', description: 'Item created successfully' });
      }
      navigate('/items');
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${isEdit ? 'update' : 'create'} item`,
        variant: 'destructive',
      });
    }
  };

  if (isLoading && isEdit) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Edit Item' : 'New Item'}</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-4">
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {isEdit ? 'Update' : 'Create'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/items')}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
```

---

## State Management

| Type | Tool | Usage |
|------|------|-------|
| **Server State** | TanStack Query | API data, caching, fetching, syncing |
| **Global Client State** | Zustand | Auth, theme, sidebar, user preferences |
| **Form State** | React Hook Form + Zod | Form state and validation |
| **Local Component State** | useState | Component-specific UI state |

**Key Rule:** Never store API data in Zustand. Use TanStack Query for all server state.

---

## UI Components (STRICT POLICY)

- **ShadCN UI Only**: No other UI libraries allowed (no MUI, Ant Design, Chakra, etc.)
- **Custom Components**: Must extend ShadCN patterns and use Radix primitives
- **Data Tables**: Use TanStack Table with ShadCN styling
- **Styling**: Tailwind CSS only (no CSS modules, styled-components, etc.)

---

## Tailwind CSS v4

This project uses Tailwind CSS v4 with CSS-first configuration:

- **No `tailwind.config.js`** - Theme defined in `index.css` via `@theme inline`
- **No `postcss.config.js`** - Uses `@tailwindcss/vite` plugin
- **Animations** - Uses `tw-animate-css` package

### Theme Configuration

```css
/* index.css */
@import "tailwindcss";
@import "tw-animate-css";

@theme inline {
  --color-primary: var(--primary);
  /* ... other theme colors */
}
```

---

## Auth Flow

1. Frontend is **provider-agnostic** (no Cognito SDK)
2. Login: Redirect to `/api/v1/auth/login`
3. Tokens stored in **HttpOnly cookies** (set by backend)
4. All API calls include cookies (`withCredentials: true`)
5. Backend validates tokens; frontend just checks auth state

---

## Commands

All commands must be run through Docker:

```bash
# Start all services
docker-compose up

# Add dependency
docker-compose exec frontend pnpm add <package>

# Add ShadCN component
docker-compose exec frontend pnpm dlx shadcn@latest add <component>

# Build
docker-compose exec frontend pnpm run build

# Lint
docker-compose exec frontend pnpm run lint
```

---

## Service URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080/us/common/admin |
| Swagger UI | http://localhost:8080/us/common/admin/swagger-ui/index.html |
