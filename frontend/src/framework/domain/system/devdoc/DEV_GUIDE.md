# LG Admin Framework Developer Guide

This guide explains how the framework works and how to build domain modules on top of it. Framework sections describe concepts and behavior; domain development sections provide concrete code examples you can copy and adapt.

## Table of Contents

1. [Introduction](#1-introduction)
2. [Architecture Overview](#2-architecture-overview)
3. [Authentication](#3-authentication)
4. [Authorization (RBAC)](#4-authorization-rbac)
5. [Menu System (Auto-Detection)](#5-menu-system-auto-detection)
6. [Routing (Auto-Discovery)](#6-routing-auto-discovery)
7. [Frontend Module Development Guide](#7-frontend-module-development-guide-key-section)
8. [Backend Module Development Guide](#8-backend-module-development-guide)
9. [Adding Permissions Checklist](#9-adding-permissions-checklist)
10. [Shared Components & Utilities](#10-shared-components--utilities)
11. [Audit Logging](#11-audit-logging)
12. [Database Migrations (Flyway)](#12-database-migrations-flyway)
13. [Standard API Response Format](#13-standard-api-response-format)
14. [Development Commands](#14-development-commands)
15. [Reference Implementations](#15-reference-implementations)

---

## 1. Introduction

The Universal Admin Framework is a production-ready foundation for building modular admin panels. It combines a Spring Boot backend with a dynamic React frontend, emphasizing security, scalability, and developer productivity.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4, ShadCN UI |
| State Management | Zustand (Global), TanStack Query (Server State), React Hook Form + Zod (Forms) |
| Backend | Spring Boot 3.3.x, Java 21, Spring Security |
| Database | PostgreSQL, Redis (Caching/Session), Flyway (Migrations) |
| Infrastructure | Docker Compose, Feign Clients (Service Proxying) |

### Key Features
- **Auth-Provider Agnostic**: Switch between providers by implementing the AuthProvider interface. Supports AWS Cognito, Auth0, and more.
- **Modular Structure**: Domain isolation ensures clean boundaries between framework and business logic.
- **Auto-Discovery Menu**: 3-level hierarchical menu automatically built from filesystem scan.
- **Centralized RBAC**: Resource-action based permissions with wildcard support (`resource:action`).
- **Automatic Audit Logging**: Hibernate interceptors and AOP aspects capture all changes and proxy calls.
- **BFF Proxy Pattern**: Secure Backend-for-Frontend manages tokens via HttpOnly cookies.
- **Service Proxy Pattern**: The backend acts as a secure proxy to downstream internal microservices.

## 2. Architecture Overview

The framework follows the BFF (Backend-for-Frontend) pattern. The frontend never handles sensitive tokens; instead, it relies on secure, HttpOnly cookies managed by the backend proxy.

### High-Level Architecture

```
Browser  ──▶  React SPA (Vite Proxy)  ──▶  Spring Boot BFF  ──▶  Downstream Microservices
                                              │         │
                                              ▼         ▼
                                        Auth Provider  PostgreSQL / Redis
                                       (Cognito/Auth0)
```

### Frontend Directory Structure

The frontend is split into `framework` (core infrastructure) and `domain` (business features).

```
src/
├── framework/           # Framework team (core features)
│   ├── core/            # Infrastructure (auth, layout, navigation, components)
│   └── domain/          # Framework modules (user/, system/audit-logs)
├── shared/              # Shared resources
│   ├── components/      # Reusable UI components (ShadCN)
│   ├── hooks/           # Custom React hooks
│   └── lib/             # Utilities (Axios, Query Client)
└── domain/              # Domain teams add modules here
    └── sample/          # Reference implementation for new modules
```

### Backend Package Structure

The backend follows a similar modular pattern to ensure that domain logic is separated from the core framework.

```
com.lg.microservice.admin/
├── common/              # Infrastructure (config, security, exception, response)
├── core/                # Framework features (auth, user, role, permission, audit)
└── domain/              # Business domains (sample, etc.)
    └── sample/          # Proxy implementation for sample service
```

### Key Principles
1. **Backend-First Security**: All auth and token management happens on the backend. No tokens in LocalStorage.
2. **Domain Isolation**: Code is organized by domain to ensure maintainability and team autonomy.
3. **Convention over Configuration**: Standardized folder structures for automatic feature registration.
4. **Service Autonomy**: Downstream services are treated as independent entities called via Feign.

## 3. Authentication

The framework abstracts authentication behind an `AuthProvider` interface, allowing seamless switching between identity providers (Cognito, Auth0, Magento, etc.) without changing application code. The backend uses `AuthConfig` to route tokens to the correct provider based on the JWT's `iss` claim.

### Auth Provider Abstraction

The `AuthProvider` interface (`core/factory/AuthProvider.java`) defines the contract every identity provider must implement:
- OAuth2 methods: login/logout URLs, token exchange (PKCE), refresh
- User resolution: `getUser(jwt)` — finds user in database, throws 403 if not found
- Callback sync: `syncUserFromCallback(tokenResponse)` — creates/updates user on OAuth callback

**Active Providers:**
- **CognitoAuthProvider**: Full OAuth2 flow, finds user by `externalUserId` (JWT subject)
- **MagentoAuthProvider**: Token validation only (no OAuth), finds user by `email` claim

### Token Storage (BFF Pattern)

The frontend stores tokens securely with different strategies for different concerns:

| Token | Storage | Purpose |
|-------|---------|---------|
| Access Token | Zustand (memory) | API authentication via Bearer header |
| Refresh Token | HttpOnly cookie | Survives page refresh, XSS-proof |

**Why not both in cookies?** Access tokens in memory can't be stolen via XSS. Refresh tokens in HttpOnly cookies survive page refresh and are never accessible to JavaScript.

### Auth Flow (Regular Login)

1. **Login**: Frontend redirects to `/api/v1/auth/login`. Backend generates PKCE challenge, redirects to provider's Hosted UI.
2. **Callback**: Provider redirects with `code`. Backend exchanges for tokens, sets **refresh_token as HttpOnly cookie**, redirects to frontend.
3. **On Page Load**: Frontend calls `POST /auth/refresh` → backend returns `{ accessToken }` in JSON body → stored in Zustand.
4. **API Calls**: Axios interceptor injects `Authorization: Bearer {accessToken}` from Zustand on every request.
5. **Token Expiry (401)**: Interceptor calls `/auth/refresh`, updates Zustand, retries failed request.
6. **Logout**: Backend revokes tokens, clears cookie, redirects to provider's logout URL.

### Embed Mode (Iframe Integration)

The framework supports embedding admin pages in iframes (e.g., Magento admin integration). In embed mode:

| Aspect | Behavior |
|--------|----------|
| URL Pattern | `?embed&token=eyJ...` |
| Token Source | URL parameter (stripped immediately) |
| Layout | `FramelessLayout` — no sidebar/header |
| Token Refresh | `postMessage(TOKEN_REFRESH)` to parent |
| On 401 (unauthenticated) | Shows `<AccessDenied />` — no Cognito redirect |

**Embed Detection (`@shared/lib/embed.ts`):**
```typescript
// Called once before React renders
initEmbedMode();  // Sets _embed flag, extracts token

// Anywhere in app
isEmbedMode();    // Returns true if ?embed was present on boot
```

**Layout Selection (`App.tsx`):**
```tsx
<Route element={isEmbedMode() ? <FramelessLayout /> : <MainLayout />}>
  {/* Same routes — layout differs based on mode */}
</Route>
```

**Token Refresh in Embed Mode:**
```typescript
// On 401 in embed mode:
window.parent.postMessage({ type: 'TOKEN_REFRESH' }, allowedOrigin);

// Parent generates new JWT, posts back:
window.postMessage({ type: 'TOKEN_REFRESHED', token: 'eyJ...' }, iframeOrigin);
```

### Frontend Auth State

The `useAuthStore` (Zustand) manages client-side auth state:

```typescript
interface AuthState {
  accessToken: string | null;    // Token in memory (Bearer header source)
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  setAccessToken: (token: string) => void;
  checkAuth: () => Promise<void>;  // POST /auth/refresh → GET /auth/me
  logout: () => Promise<void>;
}
```

On app load, `checkAuth()` calls `/auth/refresh` (unless token already in memory from embed URL), then `/auth/me` to load user info.

### Automatic Token Refresh

The shared Axios instance (`@shared/lib/axios`) handles token expiration transparently:

1. **401 detected**: Check if auth endpoint — if so, pass through (expected failure).
2. **Refresh token**:
   - Regular mode: `POST /auth/refresh` → new accessToken from JSON body
   - Embed mode: `postMessage(TOKEN_REFRESH)` → wait for `TOKEN_REFRESHED`
3. **Update Zustand**: `setAccessToken(newToken)`
4. **Retry request**: Original request replays with new token.
5. **Refresh fails**:
   - Regular mode: Redirect to `/login`
   - Embed mode: Show `<AccessDenied />` (no redirect)

Domain modules never handle 401s or token refresh — it's fully automatic.

### Downstream Service Authentication

When the backend proxies requests to downstream microservices via Feign clients, the `AuthorizationFeignInterceptor` automatically copies the `Authorization` header. The end-user's identity propagates through the entire call chain without manual header management.

## 4. Authorization (RBAC)

The framework uses a resource-action permission model with wildcard support, enforced at multiple layers.

### Permission Format

Permissions follow the pattern `resource:action`. The resource segment supports dot notation for namespacing.

**Naming convention:** Domain modules use `{resource}:{action}` (e.g., `sample:read`, `orders:create`). Framework modules prefix with `admin.` (e.g., `admin.users:create`, `admin.roles:update`).

Wildcards (`*`) allow broad access:

| Pattern | Meaning |
|---------|---------|
| `sample:read` | Read access to sample (domain module) |
| `orders:create` | Create access to orders (domain module) |
| `admin.users:read` | Read access to users (framework module) |
| `admin.roles:update` | Update access to roles (framework module) |
| `admin.users:*` | All actions on users |
| `*:read` | Read access to all resources |
| `*:*` | Full superuser access |

Permissions are stored in the database, assigned to roles, and loaded into Spring Security's `GrantedAuthority` collection when the JWT is validated. The `AppJwtAuthenticationConverter` extracts the username from the JWT, then loads the user's roles and permissions from the database via `UserService.getUserAuthorities()`. This means permission changes take effect on the next token validation without requiring re-login.

### Admin Roles (Full Access)

Each role has an `isAdmin` flag. When a role is marked as admin, users assigned to that role are automatically granted **every permission in the database** — regardless of which individual permissions are assigned to the role.

**How it works on the backend:** During authority loading (`UserService.getUserAuthorities()`), the framework checks whether any of the user's active roles has `isAdmin = true`. If so, it fetches all permissions from the `permissions` table and adds them all as `GrantedAuthority` entries. Non-admin roles go through the normal role → permissions mapping.

**How it works on the frontend:** When creating or editing a role in the Roles page, toggling the "Admin" switch automatically selects all permissions in the permission list (read-only, since admin gets everything). The UI shows a notice: "Administrator role has full access to all permissions."

This means you never need to manually assign individual permissions to an admin role — just set `isAdmin: true` and it inherits everything, including any new permissions added later via sync.

### Frontend Permission Checking

The `usePermissionStore` (Zustand) holds the current user's roles and permissions, populated after authentication. It provides helper methods with wildcard matching:

- `hasPermission('users:read')` — checks a single permission
- `hasAnyPermission(['users:read', 'users:write'])` — checks if the user has at least one
- `hasAllPermissions(['users:read', 'users:write'])` — checks if the user has all
- `hasRole('ADMIN')` — checks a role assignment

The wildcard matching logic splits both the user's permission and the required permission on `:`, then compares segment by segment. A `*` in any segment matches everything from that point forward.

### Enforcement Levels

Authorization is enforced at three levels:

1. **Route Level**: Route configs can include a `permissions` array. The `ProtectedRoute` wrapper checks these before rendering the page. If the user lacks the required permission, they see an Access Denied page.

2. **Component Level**: The `RequirePermission` component conditionally renders its children based on permission checks. It accepts a single permission or an array, with a `requireAll` flag to control AND vs OR logic. You can provide a `fallback` to render instead of nothing. Use this to hide buttons, menu items, or sections the user shouldn't see.

3. **Backend Method Level**: Spring Security's `@PreAuthorize` annotation on service methods. Example: `@PreAuthorize("hasAuthority('users:write')")`. This is the final enforcement layer — even if the frontend fails to hide something, the backend rejects unauthorized calls.

### Permission Sync (Code → Database)

You never need to manually insert permissions into the database. The framework scans `@PreAuthorize("hasAuthority('...')")` annotations at runtime and syncs them to the `permissions` table automatically.

**How it works:**

1. **Define in code**: Add `@PreAuthorize("hasAuthority('orders:read')")` to your controller or service methods. This is the single source of truth.
2. **Trigger sync**: Call `POST /v1/permissions/sync` — or click the **"Sync Permissions"** button on the Permissions page in the UI.
3. **Scan**: The `PermissionServiceImpl` uses Spring's `ApplicationContext` to find all `@RestController` beans, inspects every method for `@PreAuthorize` annotations, and extracts `hasAuthority('resource:action')` values via regex.
4. **Diff & apply**: The scanned permissions are compared against the database. New ones are **added**, permissions no longer in code are **removed**, and matching ones are left **unchanged**.
5. **Result**: The API returns a summary — `{ added: N, removed: N, unchanged: N }` — and the UI displays it as a toast notification.

This means the workflow for adding a new permission is: annotate your method → deploy → sync. No SQL scripts, no manual DB inserts.

## 5. Menu System (Auto-Detection)

The framework automatically discovers and registers sidebar menu items from the filesystem. You don't need to register menus in a central config — just place a `menu.tsx` file in your module folder and it will appear in the sidebar.

### How Discovery Works

On app initialization, the navigation engine uses Vite's `import.meta.glob` to scan two directories for `menu.tsx` files:
- `src/framework/domain/**/menu.tsx` — framework modules (users, roles, audit logs)
- `src/domain/**/menu.tsx` — domain modules (your business features)

Each discovered file is loaded asynchronously, and its default export (a `MenuItem` object) is collected. The engine then builds a tree hierarchy from the flat list of menu items based on their `id` property.

### Hierarchical Configuration (3 Levels)

The menu supports up to 3 levels of nesting. The hierarchy is determined by the slash-separated `id` — the engine splits each ID on `/` and nests children under their parent automatically.

| Level | Role | Has `path`? |
|-------|------|-------------|
| Level 1 | Collapsible root group | No — acts as a folder |
| Level 2 | Collapsible sub-group | No — acts as a sub-folder |
| Level 3 | Navigable leaf item | Yes — clicking navigates |

Only items with a `path` property are clickable in the sidebar. Parent and intermediate items are collapsible group headers.

**Level 1 — Root Group** (`src/domain/sample/menu.tsx`):
```tsx
import { Box } from \'lucide-react\';
import type { MenuItem } from \'@core/navigation/types\';

const menu: MenuItem = {
  id: \'sample\',
  label: \'Sample\',
  icon: Box,
  order: 20,
};
export default menu;
```

**Level 2 — Sub Group** (`src/domain/sample/sub-menu/menu.tsx`):
```tsx
const menu: MenuItem = {
  id: \'sample/sub-menu\',
  label: \'Sub Menu\',
  order: 1,
};
export default menu;
```

**Level 3 — Navigable Leaf** (`src/domain/sample/sub-menu/items/menu.tsx`):
```tsx
const menu: MenuItem = {
  id: \'sample/sub-menu/items\',
  label: \'Items\',
  path: \'/sample/sub-menu/items\',
  order: 1,
  permissions: [\'sample:read\'],
};
export default menu;
```

Items with a `permissions` array are automatically hidden from the sidebar for users who lack the required permissions.

## 6. Routing (Auto-Discovery)

Routes are discovered alongside menus using the same `import.meta.glob` mechanism, scanning for `routes.tsx` files in both `framework/domain/` and `domain/` directories.

### How It Works

Each `routes.tsx` file exports an array of `RouteConfig` objects (path, element, optional permissions). On app startup, the navigation engine collects all route configs and stores them in a `useRouteStore` (Zustand). The root `App.tsx` then iterates over these dynamic routes and registers each one inside a `ProtectedRoute` wrapper, which handles authentication and optional permission checks.

The result: pages are lazy-loaded, authentication is enforced automatically, and route-level permissions (when provided) are checked before rendering.

### Route Registration Example

This is what you write in your module — the framework handles the rest:

`src/domain/sample/sub-menu/items/routes.tsx`:
```tsx
import { lazy } from 'react';
import type { RouteConfig } from '@core/navigation/types';

const SampleItemsListPage = lazy(() => import('./pages/index'));
const SampleItemFormPage = lazy(() => import('./pages/SampleItemForm'));

const routes: RouteConfig[] = [
  { path: '/sample/sub-menu/items', element: <SampleItemsListPage />, permissions: ['sample:read'] },
  { path: '/sample/sub-menu/items/new', element: <SampleItemFormPage />, permissions: ['sample:create'] },
  { path: '/sample/sub-menu/items/:id', element: <SampleItemFormPage />, permissions: ['sample:read'] },
];
export default routes;
```

> **Tip**: When `permissions` is present, `ProtectedRoute` enforces the check before rendering. Use `sample:read` for the detail/edit route — component-level logic handles whether the user can actually edit vs. only view.

### Route Pattern Convention

| Pattern | Purpose |
|---------|---------|
| `/module` | List page |
| `/module/new` | Create form |
| `/module/:id` | Edit/detail form |

## 7. Frontend Module Development Guide (Key Section)

This section provides the comprehensive blueprint for building a standard domain module.

### Step 1: Folder Structure
Create your module following this structure to ensure auto-discovery:
```
src/domain/{your-module}/
├── menu.tsx              # Sidebar registration
├── routes.tsx            # URL path mapping
├── api/
│   └── {resource}.api.ts # API functions & types
├── pages/
│   ├── index.tsx         # List page (TanStack Table)
│   └── {Resource}Form.tsx # Form page (Hook Form + Zod)
└── components/           # Optional module components
```

### Step 2: API Layer Implementation
Define your types and API functions using the framework\'s axios instance.

`api/items.api.ts`:
```typescript
import apiClient from "@shared/lib/axios";

// Domain Types
export type Item = {
  id: number;
  name: string;
  description: string;
  status: string;
  createdAt: string;
};

// Response Wrappers (matching Backend)
export type PageInfo = { number: number; size: number; totalElements: number; totalPages: number; };
export type PagedResponse<T> = { success: boolean; data: T[]; page: PageInfo; };

// API Functions
export const getItems = async ({ page = 0, size = 10, query, status, sort }: any) => {
  const params = new URLSearchParams();
  params.append(\'page\', page.toString());
  params.append(\'size\', size.toString());
  if (query) params.append(\'query\', query);
  if (status && status !== \'all\') params.append(\'status\', status);
  if (sort) params.append(\'sort\', sort);

  const response = await apiClient.get<PagedResponse<Item>>(`/your-service/items?${params}`);
  return {
    content: response.data.data,
    totalPages: response.data.page.totalPages,
    totalElements: response.data.page.totalElements,
    size: response.data.page.size,
    number: response.data.page.number,
  };
};

export const deleteItem = async (id: number | string) => {
  await apiClient.delete(`/your-service/items/${id}`);
};
```

### Step 3: List Page Pattern (Detailed)
The list page is the most complex component. It features persistent column visibility, manual sorting, server-side pagination, and permission-gated actions.

`pages/index.tsx`:
```tsx
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import { SortableHeader } from "@shared/components/SortableHeader";
import { usePermissionStore } from "@core/auth/stores/permissionStore";

const COLUMN_VISIBILITY_KEY = "items-page-visibility";

export default function ItemsPage() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currPage, setCurrPage] = useState(1);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Persistence logic for UI state (Column Visibility)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY);
    return saved ? JSON.parse(saved) : {};
  });
  useEffect(() => {
    localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  // Permission checks — gate UI actions based on user permissions
  const { hasPermission } = usePermissionStore();
  const canCreate = hasPermission(\'items:create\');
  const canUpdate = hasPermission(\'items:update\');
  const canDelete = hasPermission(\'items:delete\');

  // Query parameter construction (Manual Sorting)
  const sortParam = sorting.length > 0 
    ? `${sorting[0].id},${sorting[0].desc ? "desc" : "asc"}` 
    : undefined;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["items", { query, statusFilter, currPage, sortParam }],
    queryFn: () => getItems({ query, status: statusFilter, page: currPage - 1, sort: sortParam }),
    placeholderData: (prev) => prev,
  });

  // Table Column Definitions — conditionally include select column
  const columns: ColumnDef<Item>[] = [
    // Only show checkbox column if user can delete (for bulk operations)
    ...(canDelete ? [{
      id: "select",
      header: ({ table }) => <Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(val) => table.toggleAllPageRowsSelected(!!val)} />,
      cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(val) => row.toggleSelected(!!val)} />,
    }] : []),
    {
      accessorKey: "name",
      header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <NavLink to={`./${row.original.id}?mode=view`}>
            <Button size="icon" variant="ghost" title="View"><EyeIcon className="h-4 w-4" /></Button>
          </NavLink>
          {canUpdate && (
            <NavLink to={`./${row.original.id}`}>
              <Button size="icon" variant="ghost" title="Edit"><SquarePenIcon className="h-4 w-4" /></Button>
            </NavLink>
          )}
          {canDelete && (
            <AlertDialog>
              {/* Delete confirmation dialog */}
            </AlertDialog>
          )}
        </div>
      ),
    }
  ];

  // ... table instance, rendering ...

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Items Management</h1>
        {canCreate && (
          <Button asChild><Link to="new"><PlusIcon className="mr-2 h-4 w-4" /> Add Item</Link></Button>
        )}
      </div>
      {/* Bulk delete — only shown when canDelete and rows selected */}
      {canDelete && selectedItemIds.length > 0 && (
        <Button variant="destructive">Delete ({selectedItemIds.length})</Button>
      )}
      {/* ... search, filters, table, pagination ... */}
    </div>
  );
}
```

### Step 4: Form Page Pattern
The form pattern uses a centered card layout and handles create, edit, and view modes based on URL parameters. Permission checks gate the Edit and Submit buttons.

```tsx
import { usePermissionStore } from "@core/auth/stores/permissionStore";

const formSchema = zod.object({
  name: zod.string().min(2, "Name is required"),
  status: zod.enum(["active", "inactive"]),
});

export function ItemForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const mode = searchParams.get("mode") === "view" ? "view" : id ? "edit" : "create";
  const isViewMode = mode === "view";
  const isEditMode = mode === "edit";

  // Permission checks for form actions
  const { hasPermission } = usePermissionStore();
  const canCreate = hasPermission(\'items:create\');
  const canUpdate = hasPermission(\'items:update\');

  const form = useForm({ 
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", status: "active" }
  });

  const onSubmit = async (values: any) => {
    try {
      if (isEditMode) await updateItem(id, values);
      else await createItem(values);
      toast.success("Item saved successfully");
      navigate("/sample/items");
    } catch (error) {
      toast.error("An error occurred while saving");
    }
  };

  return (
    <Card className="max-w-2xl mx-auto mt-8">
      <CardHeader><CardTitle>{isViewMode ? "View Item" : isEditMode ? "Edit Item" : "Create New Item"}</CardTitle></CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-6">
          {/* ... form fields ... */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => navigate(-1)}>
              {isViewMode ? "Back to List" : "Cancel"}
            </Button>
            {isViewMode ? (
              canUpdate && <Button type="button" onClick={() => navigate(`/items/${id}`)}>Edit</Button>
            ) : (
              (isEditMode ? canUpdate : canCreate) && (
                <Button type="submit">{isEditMode ? "Update" : "Create"}</Button>
              )
            )}
          </div>
        </form>
      </Form>
    </Card>
  );
}
```

## 8. Backend Module Development Guide

The backend focuses on providing a secure proxy and data transformation layer.

### Package Structure
```
domain/{service-name}/
├── controller/{Name}Controller.java  # Thin REST API
├── service/{Name}Service.java          # Business Interface
├── service/impl/{Name}ServiceImpl.java # Logic Implementation
├── feign/{Name}FeignClient.java        # Microservice Proxy
└── dto/                                # Java 21 Records
```

### Step 1: External Service Integration
Define the downstream service URL in `application.yml`:
```yaml
microservice:
  host: http://microservice.internal
  sample: ${microservice.host}/us/common/sample-service/v1
```

### Step 2: Feign Client (Proxy)
The `AuthorizationFeignInterceptor` ensures that the user\'s authorization header is propagated to the downstream service.

```java
@FeignClient(
    name = "SampleFeignClient",
    url = "${microservice.sample}",
    configuration = AuthorizationFeignInterceptor.class
)
public interface SampleFeignClient {
    @GetMapping("/items")
    PageResponse<SampleItemDto> getItems(
        @RequestParam int page, @RequestParam int size,
        @RequestParam String query, @RequestParam String status,
        @RequestParam String sort
    );

    @GetMapping("/items/{id}")
    DataResponse<SampleItemDto> getItem(@PathVariable("id") Long id);

    @PostMapping("/items")
    DataResponse<SampleItemDto> createItem(@RequestBody CreateSampleItemRequest request);

    @DeleteMapping("/items/{id}")
    void deleteItem(@PathVariable("id") Long id);
}
```

### Step 3: Controller Implementation
Keep controllers thin. Apply `@PreAuthorize` at the **method level** with `hasAuthority('resource:action')` so that each endpoint enforces a specific permission. The permission sync scanner automatically discovers these annotations and syncs them to the database (see Section 4).

```java
@RestController
@RequestMapping("/v1/sample")
@RequiredArgsConstructor
@Tag(name = "Sample Service", description = "Proxy for Sample Service APIs")
public class SampleController {
    private final SampleService sampleService;

    @PreAuthorize("hasAuthority('sample:read')")
    @GetMapping("/items")
    public ResponseEntity<PageResponse<SampleItemDto>> getItems(...) {
        return ResponseEntity.ok(sampleService.getItems(...));
    }

    @PreAuthorize("hasAuthority('sample:read')")
    @GetMapping("/items/{id}")
    public ResponseEntity<DataResponse<SampleItemDto>> getItem(@PathVariable Long id) {
        return ResponseEntity.ok(sampleService.getItem(id));
    }

    @PreAuthorize("hasAuthority('sample:create')")
    @PostMapping("/items")
    public ResponseEntity<DataResponse<SampleItemDto>> createItem(@RequestBody CreateSampleItemRequest request) {
        return ResponseEntity.ok(sampleService.createItem(request));
    }

    @PreAuthorize("hasAuthority('sample:update')")
    @PutMapping("/items/{id}")
    public ResponseEntity<DataResponse<SampleItemDto>> updateItem(@PathVariable Long id, @RequestBody UpdateSampleItemRequest request) {
        return ResponseEntity.ok(sampleService.updateItem(id, request));
    }

    @PreAuthorize("hasAuthority('sample:delete')")
    @DeleteMapping("/items/{id}")
    public ResponseEntity<Void> deleteItem(@PathVariable Long id) {
        sampleService.deleteItem(id);
        return ResponseEntity.noContent().build();
    }
}
```

**Permission naming convention**: Domain modules use `{resource}:{action}` (e.g., `sample:read`, `orders:create`). Framework modules prefix with `admin.` (e.g., `admin.users:create`, `admin.roles:update`).

### Step 4: DTOs as Records
Records are perfect for DTOs as they provide built-in constructors, accessors, and `toString()` methods.

```java
public record SampleItemDto(
    Long id, 
    String name, 
    String description, 
    LocalDateTime createdAt
) {}

public record CreateSampleItemRequest(
    @NotBlank(message = "Name is mandatory") String name,
    @Size(max = 500) String description
) {}
```

## 9. Adding Permissions Checklist

When adding permission-gated features to a new or existing module, follow these five steps in order:

### Step 1: Backend — Annotate Controller Methods
Add `@PreAuthorize("hasAuthority('resource:action')")` to each endpoint. Use `resource:read`, `resource:create`, `resource:update`, `resource:delete` as the standard actions.

### Step 2: Sync Permissions to Database
Call `POST /v1/permissions/sync` or click **"Sync Permissions"** on the Permissions page. The scanner discovers all `hasAuthority(...)` annotations and inserts them into the `permissions` table. Assign the new permissions to the appropriate roles.

### Step 3: Menu — Add `permissions` Array
Add `permissions: ['resource:read']` to your leaf `menu.tsx`. The sidebar auto-hides menu items the user lacks permission to see.

### Step 4: Routes — Add `permissions` per Route
Add `permissions` to each `RouteConfig` entry. The `ProtectedRoute` wrapper blocks access to pages the user can't reach.

| Route | Permission |
|-------|-----------|
| List page | `resource:read` |
| Create page | `resource:create` |
| Detail/Edit page | `resource:read` (component-level logic gates editing) |

### Step 5: Components — Gate UI Actions
Import `usePermissionStore` and call `hasPermission()` to conditionally render buttons:

- **Create button**: Show only if `canCreate`
- **Edit button/link**: Show only if `canUpdate`
- **Delete button**: Show only if `canDelete`
- **Checkbox column** (bulk select): Include only if `canDelete`
- **Bulk delete button**: Show only if `canDelete` and rows are selected
- **Form submit button**: Gate by mode — create needs `resource:create`, edit needs `resource:update`
- **Edit button in view mode**: Show only if `canUpdate`

> **Refer to**: `src/domain/sample/` for the complete working reference implementation covering all five steps above.

## 10. Shared Components & Utilities

### ShadCN UI Components
The framework pre-installs:
alert, alert-dialog, avatar, badge, button, button-group, calendar, card, checkbox, collapsible, combobox, command, dialog, drawer, dropdown-menu, field, form, input, input-group, item, label, pagination, popover, radio-group, select, separator, sheet, sidebar, skeleton, sonner, spinner, switch, table, textarea, toast, toaster, tooltip.

### Framework Core Components
| Component | Import | Usage |
|-----------|--------|-------|
| PaginationControl | `@core/components/PaginationControl` | Standard table pagination controls |
| Loading | `@core/components/Loading` | Full-page loading spinner with overlay |
| Spinner | `@shared/components/ui/spinner` | Small, inline loading indicator |
| AccessDenied | `@shared/components/AccessDenied` | 403 Forbidden error page |
| ServerError | `@shared/components/ServerError` | 500 Internal Server Error page |
| ErrorBoundary | `@core/components/ErrorBoundary` | React error boundary wrapper |

### Hooks & Stores
| Hook/Store | Import | Usage |
|------------|--------|-------|
| useAuthStore | `@core/auth/stores/authStore` | Access `isAuthenticated`, `user`, `logout()` |
| usePermissionStore | `@core/auth/stores/permissionStore` | `hasPermission(\'res:act\')`, `hasRole(\'ADMIN\')` |
| useToast | `@shared/hooks/use-toast` | Trigger `toast({ title, description })` |

### Key Path Aliases
| Alias | Maps To | Usage |
|-------|---------|-------|
| `@/` | `src/` | Internal ShadCN paths |
| `@core/` | `src/framework/core/` | Framework-level core logic |
| `@shared/` | `src/shared/` | UI components, utils, hooks |
| `@domain/` | `src/domain/` | Business modules |

## 11. Audit Logging

Logging is highly automated and categorized into two main streams.

### 1. Database Level (Hibernate Interceptor)
The `DatabaseAuditInterceptor` detects changes to any entity managed by Hibernate.
- **Coverage**: `User`, `Role`, `Permission` and other core entities.
- **Data**: Records "Before" and "After" state as JSON diffs.
- **Metadata**: Logs User Email, IP Address, Endpoint, and User Agent.

### 2. Service Level (Proxy AOP)
The `ProxyAuditAspect` intercepts controller calls in `domain.*.controller`.
- **Coverage**: POST, PUT, DELETE, PATCH methods.
- **Data**: Logs Request Body, Response Status, and Execution Duration.
- **Traceability**: Generates a Correlation ID for end-to-end tracing across services.

### Detail Storage Modes

The `audit.detail-storage` setting (env var `AUDIT_DETAIL_STORAGE`) controls where the detailed payload (before/after state, request/response body) is stored. Both interceptors follow the same branching logic. The audit row itself (user, action, resource, timestamp, endpoint, IP, correlation ID) is **always** written to the database regardless of mode.

| Mode | Detail Payload Destination | Use Case |
|------|---------------------------|----------|
| `db` (default) | Stored in the `details` JSONB column of `audit_logs` table | Full audit trail queryable from the Audit Logs UI |
| `file` | Emitted as structured JSON to stdout via `log.info("AuditLog: {...}")`. The `details` column is set to `null`. | APM integration — tools like NewRelic, Datadog, or Splunk ingest the structured log output |

**`db` mode** is recommended for most deployments. It keeps everything in one place and powers the Audit Logs page in the UI.

**`file` mode** is useful when you want lightweight DB rows (metadata only) and rely on an external APM/log aggregation platform to capture and index the full payloads from stdout.

```yaml
audit:
  detail-storage: db    # or "file" for APM/stdout mode
```

## 12. Database Migrations (Flyway)

Flyway auto-migration is **explicitly disabled** (`spring.flyway.enabled: false`). Migrations are never run automatically on startup — you must trigger them manually.

### Why Disabled?

Auto-migration on startup can cause issues in multi-instance deployments (race conditions), and makes it harder to control when schema changes are applied. The framework uses an explicit API call approach so migrations are intentional and auditable.

### How to Migrate

The migration endpoint is provided by the LG common Flyway library (`com.lg.microservice:common.lib.flyway`):

```bash
# Trigger migration via API
curl -X POST http://localhost:8080/us/common/admin/flyway/migrate
```

### Migration File Locations

Migration SQL files are organized by environment:

| Directory | Purpose |
|-----------|---------|
| `flyway/common/` | Shared migrations — applied to all environments |
| `flyway/env/local/` | Local development only |
| `flyway/env/dev/` | Dev environment only |
| `flyway/env/qa/` | QA environment only |
| `flyway/env/stg/` | Staging environment only |
| `flyway/env/prd/` | Production environment only |

Each Spring profile activates its corresponding location in addition to `flyway/common/`. For example, the `LOCAL_CFG` profile uses `classpath:flyway/common,classpath:flyway/env/local`.

## 13. Standard API Response Format

Every API follows a strict wrapper format to ensure the frontend can handle data predictably.

### DataResponse
Used for single object returns.
```json
{
  "success": true,
  "data": { "id": 101, "name": "Project X" },
  "message": "Success"
}
```

### PageResponse
Used for collections with pagination metadata.
```json
{
  "success": true,
  "data": [ { "id": 1 }, { "id": 2 } ],
  "page": {
    "number": 0,
    "size": 10,
    "totalElements": 100,
    "totalPages": 10,
    "first": true,
    "last": false
  }
}
```

### ErrorResponse
Detailed error information for debugging and UI feedback.
```json
{
  "success": false,
  "code": "INVALID_PARAMETER",
  "message": "Validation failed",
  "errors": [ { "field": "email", "message": "Must be a valid email" } ],
  "timestamp": "2025-02-12T10:00:00Z",
  "path": "/v1/sample/items"
}
```

## 14. Development Commands

Standardized commands for consistent developer experience.

### Service Orchestration
```bash
docker-compose up -d           # Start all services in background
docker-compose down            # Stop and remove containers
docker-compose restart backend # Restart backend after code changes
docker-compose logs -f         # View real-time logs for all services
```

### Frontend Tasks
```bash
docker-compose exec frontend pnpm add <pkg>             # Add npm dependency
docker-compose exec frontend pnpm dlx shadcn@latest add # Add UI component
docker-compose exec frontend pnpm run build             # Production build
docker-compose exec frontend pnpm run lint              # Code linting
```

### Backend Tasks
```bash
docker-compose exec backend ./gradlew build             # Build JAR
docker-compose exec backend ./gradlew test              # Run unit tests
docker-compose exec backend ./gradlew compileJava       # Check compilation
docker-compose exec backend ./gradlew flywayMigrate     # Run migrations
```

### Service Entrypoints
| Entrypoint | URL |
|------------|-----|
| Frontend App | http://localhost:3000 |
| Backend API | http://localhost:8080/us/common/admin |
| Swagger Docs | http://localhost:8080/us/common/admin/swagger-ui/index.html |
| Health Check | http://localhost:8080/us/common/admin/actuator/health |

## 15. Reference Implementations

The following modules serve as the "Gold Standard" for coding patterns within the system.

| Module | Path | Learning Focus |
|--------|------|----------------|
| Users | `src/framework/domain/user/users/` | High-complexity list pages with bulk actions. |
| Roles | `src/framework/domain/user/roles/` | Permission tree management and nested forms. |
| Audit Logs | `src/framework/domain/system/audit-logs/` | Read-only reporting and date filters. |
| Sample | `src/domain/sample/` | Reference for 3-level menu and routing discovery. |
| Core Auth | `src/framework/core/auth/` | Auth state management and token lifecycle. |
