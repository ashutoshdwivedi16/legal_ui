# Technical Requirements Document (TRD)
## Universal Admin Framework

**Version:** 1.0  
**Date:** 2025-12-01  
**Status:** Draft

---

## Table of Contents

1. [Overview](#overview)
2. [Technical Architecture](#technical-architecture)
3. [Technology Stack](#technology-stack)
4. [LG Common Libraries](#lg-common-libraries)
5. [Database Schema Design](#database-schema-design)
6. [API Specifications](#api-specifications)
7. [Frontend Implementation](#frontend-implementation)
8. [CRUDL Standard Pattern](#crudl-standard-pattern)
9. [Standard List Page Pattern](#standard-list-page-pattern)
10. [Standard Form Page Pattern](#standard-form-page-pattern-create--edit--view)
11. [Backend Implementation](#backend-implementation)
12. [Admin Module CRUDL - Backend Implementation](#admin-module-crudl---backend-implementation)
13. [Authentication & Authorization](#authentication--authorization)
14. [Service Proxy Pattern](#service-proxy-pattern)
15. [Performance & Scalability](#performance--scalability)
16. [Deployment Architecture](#deployment-architecture)

---

## Overview

This Technical Requirements Document (TRD) specifies the technical architecture, implementation details, and technology decisions for the Universal Admin Framework. For product requirements and business context, see [PRD.md](./PRD.md).

**Key Technical Principles:**
- Backend is a full admin application with its own PostgreSQL database
- Modular frontend with code splitting per service module
- Services are hardcoded in the backend for faster development
- Centralized authorization before proxying to microservices
- Use of LG common libraries for consistency across microservices

---

## Technical Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Application                      │
│  (React + Vite + ShadCN + TypeScript + Zustand + TanStack)  │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Module A   │  │   Module B   │  │   Module N   │     │
│  │ (Code Split) │  │ (Code Split) │  │ (Code Split) │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ HTTP/REST API
                             │
┌─────────────────────────────────────────────────────────────┐
│         Backend Admin Application (Spring Boot)              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Admin Features (Own Domain)                 │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │  │
│  │  │ User Mgmt    │  │ Role/Perm    │  │ Audit    │ │  │
│  │  │ (Cognito     │  │ Management   │  │ Logs     │ │  │
│  │  │  Integration)│  │ (RBAC/ACL)   │  │ Mgmt     │ │  │
│  │  └──────────────┘  └──────────────┘  └──────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Auth Layer  │  │ Authorization│  │ Service      │     │
│  │  (Cognito    │  │  Guard       │  │ Proxy Layer  │     │
│  │  Validation) │  │  (RBAC/ACL)  │  │ (Hardcoded)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         │                   │                   │
┌───────▼──────┐  ┌─────────▼────────┐  ┌──────▼──────┐
│  PostgreSQL  │  │  Service A       │  │  Service N  │
│  Database    │  │  (Microservice)  │  │(Microservice)│
│              │  └──────────────────┘  └─────────────┘
│  - Users     │
│  - Roles     │
│  - Permissions│
│  - Audit Logs│
└──────────────┘
```

### Frontend Architecture

#### Directory Structure

```
src/
├── framework/
│   ├── core/         # Pure infrastructure (NO routes/menu)
│   │   ├── auth/
│   │   ├── layout/
│   │   ├── pages/
│   │   ├── components/
│   │   └── navigation/  # Auto-discovery engine
│   └── domain/       # Framework features WITH routes/menu
│       ├── user/     # User Management (users, roles, permissions, profile)
│       └── audit-logs/
├── shared/           # ShadCN UI, utilities (unchanged location)
└── domain/           # Domain team modules
    └── {service-name}/  # Use placeholder, NOT "communication"
```

#### Auto-Discovery Convention

The framework uses an auto-discovery pattern to register routes and menu items from domain modules using `import.meta.glob()`.

##### MenuItem Type

```typescript
interface MenuItem {
  id: string;            // Hierarchical ID: 'parent/child/grandchild'
  label: string;         // Display label
  path?: string;         // Route path (leaf nodes only)
  icon?: LucideIcon;     // Icon component (typically on root parent nodes)
  order: number;         // Sort order within parent
  permissions?: string[]; // Required permissions
  children?: MenuItem[]; // Nested items (auto-populated by discovery engine)
}
```

##### Menu ID Convention (IMPORTANT)

Menu IDs use a hierarchical slash-separated format that determines parent-child relationships:

| Level | ID Format | Example |
|-------|-----------|---------|
| Root | `'parent'` | `'sample'` |
| Child | `'parent/child'` | `'sample/sub-menu'` |
| Grandchild | `'parent/child/grandchild'` | `'sample/sub-menu/items'` |

The auto-discovery engine parses these IDs to build the menu tree hierarchy automatically.

##### Menu Configuration Examples

**1. Root Menu (Parent with icon):**
```typescript
// src/domain/sample/menu.tsx
import { Beaker } from 'lucide-react';
import type { MenuItem } from '@core/navigation/types';

export const menu: MenuItem = {
  id: 'sample',           // Root level
  label: 'Sample',
  icon: Beaker,           // Icon shown in sidebar
  order: 20,
};
```

**2. Intermediate Menu (Child without path):**
```typescript
// src/domain/sample/sub-menu/menu.tsx
import type { MenuItem } from '@core/navigation/types';

export const menu: MenuItem = {
  id: 'sample/sub-menu',  // Child of 'sample'
  label: 'Sub-menu',
  order: 1,
  // No path - this is a collapsible group, not a navigable item
};
```

**3. Leaf Menu (Navigable item with path):**
```typescript
// src/domain/sample/sub-menu/items/menu.tsx
import type { MenuItem } from '@core/navigation/types';

export const menu: MenuItem = {
  id: 'sample/sub-menu/items',  // Grandchild of 'sample'
  label: 'Items',
  path: '/sample/sub-menu/items',  // Navigable - has path
  order: 1,
  permissions: ['sample:read'],
};
```

##### Route Configuration (`routes.tsx`)

Routes are defined alongside menu configuration:

```typescript
// src/domain/sample/sub-menu/items/routes.tsx
import { Route } from 'react-router-dom';
import { lazy } from 'react';
import { ProtectedRoute } from '@core/auth/components/ProtectedRoute';
import { MainLayout } from '@core/layout/MainLayout';

const SampleItemsPage = lazy(() => import('./pages'));
const SampleItemForm = lazy(() => import('./pages/SampleItemForm'));

export const routes = (
  <Route element={<ProtectedRoute />}>
    <Route element={<MainLayout />}>
      <Route path="/sample/sub-menu/items" element={<SampleItemsPage />} />
      <Route path="/sample/sub-menu/items/new" element={<SampleItemForm />} />
      <Route path="/sample/sub-menu/items/:id" element={<SampleItemForm />} />
    </Route>
  </Route>
);
```

##### Folder Structure for Multi-Level Menu

```
src/domain/sample/
├── menu.tsx                          # id: 'sample' (root)
└── sub-menu/
    ├── menu.tsx                      # id: 'sample/sub-menu' (intermediate)
    └── items/
        ├── menu.tsx                  # id: 'sample/sub-menu/items' (leaf)
        ├── routes.tsx                # Route definitions
        ├── api/
        │   └── sample.api.ts         # API layer
        ├── pages/
        │   ├── index.tsx             # List page
        │   └── SampleItemForm.tsx    # Create/Edit form
        └── components/               # Module-specific components
```

##### Scanning Pattern

The navigation engine scans for menu and route files using:
```typescript
// Menu discovery
const menuModules = import.meta.glob([
  '../../framework/domain/**/menu.tsx',
  '../../domain/**/menu.tsx'
], { eager: true });

// Route discovery
const routeModules = import.meta.glob([
  '../../framework/domain/**/routes.tsx',
  '../../domain/**/routes.tsx'
], { eager: true });
```

**Note:** The `**` glob pattern enables scanning nested directories for multi-level menu support.

#### Sidebar Rendering

The sidebar uses recursive rendering to support unlimited nesting levels. The `RecursiveMenuSubItem` component in `AppSidebar.tsx` handles:
- Collapsible groups for non-leaf items (items with children or without `path`)
- Direct navigation links for leaf items (items with `path`)
- Proper indentation at each nesting level

#### Breadcrumb Behavior

The breadcrumb component (`framework/core/layout/components/Breadcrumb.tsx`) automatically generates navigation path from the current URL. Key behaviors:

- **Clickable segments**: Only segments with defined routes become clickable links
- **Non-clickable segments**: Intermediate path segments without routes render as plain text
- **Route awareness**: Uses `useRouteStore` to check if a path has a registered route

Example: For path `/sample/sub-menu/items`:
- "Home" → Clickable (has route `/`)
- "Sample" → Non-clickable (no route for `/sample`)
- "Sub-menu" → Non-clickable (no route for `/sample/sub-menu`)
- "Items" → Clickable (has route `/sample/sub-menu/items`)

#### Path Aliases

| Alias | Maps To | Purpose |
|-------|---------|---------|
| `@/` | `src/` | ShadCN convention (used internally by ShadCN components) |
| `@core/` | `src/framework/core/` | Framework core (auth, layout, navigation, components) |
| `@shared/` | `src/shared/` | Shared UI components (ShadCN), utilities, lib |
| `@domain/` | `src/domain/` | Cross-domain imports between business modules |

**Usage Examples:**
```typescript
// Framework core imports
import { useAuthStore } from '@core/auth/stores/authStore';
import { MainLayout } from '@core/layout/components/MainLayout';
import { ProtectedRoute } from '@core/auth/components/ProtectedRoute';

// Shared imports
import { Button } from '@shared/components/ui/button';
import { apiClient } from '@shared/lib/api-client';

// Cross-domain imports (rare)
import { SomeSharedType } from '@domain/other-module/types';
```

**Note:** The `@framework/` alias was removed. Use `@core/` for framework core imports.

#### Architecture Principles

1. **Modular Architecture**
   - Framework features encapsulated in `framework/`
   - Business domain modules in `domain/`
   - Independent code splitting per module via React.lazy()

2. **Route Composition Pattern**
   - Each module exports a `routes.tsx` with its Route elements
   - Auto-discovery engine composes all routes dynamically
   - Enables clean separation and lazy loading

3. **State Management Strategy**

   **Key Principle: Separation of Concerns**

   | Library | Purpose | What It Manages |
   |---------|---------|-----------------|
   | **TanStack Query** | Server state | API data, caching, fetching, syncing, background updates |
   | **Zustand** | Client state | UI state, theme, sidebar, modals, local preferences |

   **They are complementary, NOT alternatives.**

   **Usage Guidelines:**

   - **TanStack Query for ALL server data:**
     - API responses (users, roles, any fetched data)
     - Handles caching, deduplication, background refetch automatically
     - Never store API data in Zustand

   - **Zustand for client-only state:**
     - UI state (sidebar open/closed, modal visibility)
     - User preferences (theme, language)
     - Auth state (special case - checked synchronously for route guards)

   **Standard Pattern (from bulletproof-react):**

   ```
   domain/{feature}/
   └── api/                        # API layer
       ├── get-users.ts            # API function + queryOptions + useUsers hook
       ├── create-user.ts          # API function + useMutation hook
       └── index.ts
   ```

   Each API file contains three parts:

   ```typescript
   // 1. Pure API function (no hooks)
   export const getUsers = (): Promise<{ data: User[] }> => {
     return api.get('/users');
   };

   // 2. Query options (reusable config)
   export const getUsersQueryOptions = () => {
     return queryOptions({
       queryKey: ['users'],
       queryFn: getUsers,
     });
   };

   // 3. Custom hook (thin wrapper)
   export const useUsers = (config?: QueryConfig) => {
     return useQuery({
       ...getUsersQueryOptions(),
       ...config,
     });
   };
   ```

   **Anti-Pattern - Do NOT do this:**

   ```typescript
   // ❌ BAD - storing server data in Zustand
   const useUserStore = create((set) => ({
     users: [],
     fetchUsers: async () => {
       const res = await api.get('/users');
       set({ users: res.data });  // Don't do this!
     },
   }));
   ```

   **Correct Pattern:**

   ```typescript
   // ✅ GOOD - TanStack Query handles server state
   const { data: users, isLoading } = useUsers();

   // ✅ GOOD - Zustand for UI state only
   const { sidebarOpen, toggleSidebar } = useUIStore();
   ```

   **Where Things Live:**

   | Concern | Location | Library |
   |---------|----------|---------|
   | Axios instance | `shared/lib/api-client.ts` | axios |
   | API functions | `domain/{feature}/api/*.ts` | Plain functions |
   | Query hooks | `domain/{feature}/api/*.ts` | TanStack Query |
   | Mutation hooks | `domain/{feature}/api/*.ts` | TanStack Query |
   | UI state | `domain/{feature}/stores/*.ts` | Zustand |
   | Auth state | `framework/core/auth/stores/authStore.ts` | Zustand (special case) |

   **Why Auth is in Zustand:**
   - Checked synchronously for route guards
   - Set once and rarely changes
   - Not typical CRUD server state

   **Summary:**
   - Global app state (auth, theme, sidebar): **Zustand**
   - Server state (API data): **TanStack Query**
   - Module-specific UI state: Module-scoped **Zustand** stores
   - Form state: **React Hook Form** (recommended)

### Backend Architecture

#### Directory Structure (Layered Architecture)

```
backend/
├── src/main/java/com/lg/microservice/admin/
│   ├── AdminServiceApplication.java
│   ├── common/                          # Pure infrastructure (no business logic)
│   │   ├── annotation/                 # Custom annotations
│   │   ├── config/                     # Global configuration
│   │   │   └── RestTemplateConfig.java
│   │   ├── exception/                  # Exception handling
│   │   │   ├── ErrorCode.java
│   │   │   ├── ErrorConstants.java
│   │   │   ├── RestCustomCode.java
│   │   │   ├── RestCustomException.java
│   │   │   └── RestExceptionHandler.java
│   │   ├── response/                   # Response wrappers
│   │   │   ├── DataResponse.java
│   │   │   ├── ErrorResponse.java
│   │   │   └── PageResponse.java
│   │   ├── security/                   # Security infrastructure
│   │   │   ├── AuthConfig.java         # Central issuer→provider/decoder registry
│   │   │   ├── AppJwtDecoder.java      # Multi-provider JWT decoder
│   │   │   ├── AppJwtConverter.java    # JWT → Authentication converter
│   │   │   ├── CustomPermissionEvaluator.java
│   │   │   ├── MethodSecurityConfig.java
│   │   │   └── SecurityConfig.java
│   │   └── validator/                  # Custom validators
│   ├── utils/                           # Static utility helpers
│   ├── core/                            # Framework module (auth, user, rbac)
│   │   ├── controller/
│   │   │   └── AuthController.java
│   │   ├── service/
│   │   │   ├── AuthService.java
│   │   │   ├── AuthStateStore.java
│   │   │   └── UserService.java        # User CRUD + getUserByEmail/ExternalId
│   │   ├── repository/
│   │   │   ├── UserRepository.java
│   │   │   └── RoleRepository.java
│   │   ├── model/
│   │   │   ├── dto/
│   │   │   │   ├── CallbackRequest.java
│   │   │   │   ├── LoginUrlResponse.java
│   │   │   │   ├── TokenResponse.java
│   │   │   │   ├── TokenRefreshResponse.java
│   │   │   │   └── UserInfoResponse.java
│   │   │   └── entity/
│   │   │       ├── Permission.java
│   │   │       ├── Role.java
│   │   │       └── User.java
│   │   ├── factory/                    # Auth provider abstraction
│   │   │   ├── AuthProvider.java       # Interface: getUser(), syncUserFromCallback()
│   │   │   ├── AuthProviderFactory.java
│   │   │   ├── AuthProviderProperties.java
│   │   │   └── provider/
│   │   │       ├── CognitoAuthProvider.java   # OAuth2 + getUser by externalId
│   │   │       └── MagentoAuthProvider.java   # Token-only + getUser by email
│   │   ├── constant/
│   │   ├── feign/
│   │   └── exception/
│   └── domain/                          # Business domains (future modules)
│       └── admin/                      # Admin Management (future: users, roles, audit)
├── src/main/resources/
│   ├── application.yml               # Application configuration
│   ├── logback-spring.xml            # Logging configuration
│   └── db/migration/                 # Flyway migrations
└── build.gradle                      # Build configuration
```

#### Architecture Principles

1. **Layered Architecture**
   - `common/` - Pure infrastructure (security, exception handling, response wrappers)
   - `utils/` - Static utility helpers
   - `core/` - Framework module (authentication, user sync, RBAC)
   - `domain/` - Business domains (future feature modules)

2. **Module Structure**
   - `core/` - Framework-level concerns (auth, user, roles, permissions)
   - `domain/admin/` - Admin-specific business logic (future)
   - Future domains can be added as needed (e.g., `domain/email/`)

3. **Common Layer**
   - `common/config/` - Global Spring configuration (RestTemplate, etc.)
   - `common/exception/` - Exception handling (RestCustomException, ErrorCode)
   - `common/security/` - Authentication infrastructure (AuthConfig, AppJwtDecoder, AppJwtConverter, SecurityConfig)
   - `common/response/` - Response wrappers (DataResponse, PageResponse)

4. **Core Module**
   - `core/controller/` - REST controllers (AuthController)
   - `core/service/` - Application services (AuthService, UserService)
   - `core/repository/` - JPA repositories
   - `core/model/entity/` - JPA entities (User, Role, Permission)
   - `core/model/dto/` - DTOs for request/response
   - `core/factory/` - Auth provider abstraction (AuthProvider interface + implementations)

5. **Dual Role Architecture**
   - **Admin Application**: Provides its own admin features with database persistence
   - **Service Proxy**: Acts as an authorized gateway to downstream microservices

6. **Authentication Architecture**

   The auth system is provider-agnostic, supporting multiple authentication sources:

   ```
   SecurityConfig
       ↓
   AppJwtDecoder (JwtDecoder)
       │ ← uses AuthConfig.peekIssuer() to route
       ↓
   AuthConfig.getDecoder(issuer)
       │ ← returns issuer-specific JwtDecoder
       ↓
   AppJwtConverter (Converter<Jwt, Authentication>)
       │ ← uses AuthConfig.getProvider(jwt)
       ↓
   AuthProvider.getUser(jwt)
       │ ← Cognito: findByExternalId, Magento: findByEmail
       ↓
   UserService.getUserAuthorities(user)
       │ ← loads roles/permissions from DB
       ↓
   JwtAuthenticationToken (with authorities)
   ```

   **Key Classes:**
   - `AuthConfig` — Central registry mapping issuers to providers and decoders
   - `AppJwtDecoder` — Routes to correct decoder based on token's `iss` claim
   - `AppJwtConverter` — Converts validated JWT to Spring Security Authentication
   - `AuthProvider` — Interface for authentication providers (Cognito, Magento)
   - `CognitoAuthProvider` — Full OAuth2 flow, finds user by `externalUserId`
   - `MagentoAuthProvider` — Token validation only, finds user by email

   **Authorization is 100% database-driven.** JWT claims (groups, scopes) are ignored.

7. **Service Integration**
   - Services are hardcoded in the backend (not configuration-driven)
   - Each service has dedicated controller/service classes
   - Faster development, easier debugging, explicit dependencies

---

## Technology Stack

### Frontend Stack

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

**Tailwind CSS v4 Configuration:**
- Uses `@tailwindcss/vite` plugin (no PostCSS config needed)
- CSS-first configuration via `@theme` directive in `index.css`
- No `tailwind.config.js` file (removed in v4)
- Animations via `tw-animate-css` (replaces `tailwindcss-animate`)

**Theme System (oklch colors):**
- Uses oklch() color format for better color perception consistency
- CSS variables defined in `index.css` under `:root` and `.dark` selectors
- Includes sidebar-specific CSS variables for ShadCN Sidebar component
- Example: `--primary: oklch(0.21 0.006 285.88);`

**Zero-Config Frontend:**
- Frontend requires NO environment variables
- All API calls go through the backend proxy at `/api/v1`
- Nginx (production) and Vite (dev) handle proxying to backend
- Domain modules should NEVER call microservices directly

**UI Component Policy (STRICT):**
- **ShadCN UI Only**: No other UI component libraries allowed (no MUI, Ant Design, Chakra, etc.)
- **Custom Components**: Allowed, but must:
  - Extend or compose existing ShadCN components
  - Follow ShadCN patterns and conventions
  - Use Radix UI primitives for accessibility
  - Use Tailwind CSS for styling (no CSS modules, styled-components, etc.)
- **Data Tables**: Use [TanStack Table](https://tanstack.com/table) with ShadCN styling (ShadCN provides DataTable example)
- **Future**: Custom components may be published to private ShadCN registry

### Backend Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Framework | Spring Boot | 3.3.x | Application framework |
| Language | Java | 21 | Programming language |
| Build Tool | Gradle | Latest | Build and dependency management |
| Security | Spring Security | 3.3.x | Authentication and authorization |
| Data Access | Spring Data JPA | 3.3.x | ORM and repository pattern |
| Database | PostgreSQL | 16 | Primary database |
| Migrations | Flyway | 10.x | Database version control |
| Caching | Redis | 7.x | Distributed caching |
| API Docs | SpringDoc OpenAPI | 2.6.x | OpenAPI/Swagger documentation |
| HTTP Client | OpenFeign | Latest | Service-to-service communication |
| Logging | Logback + Logstash | Latest | Structured logging |

---

## LG Common Libraries

The backend uses LG common libraries for consistency across microservices. These libraries are pre-loaded and must be used as specified.

### 1. common.lib.exception

**Purpose**: Standardized exception handling across microservices

**Usage**:
- All exceptions must use `RestCustomException` from this library
- Custom error codes defined in `RestCustomCode`
- Exception handler (`RestExceptionHandler`) automatically converts exceptions to standardized error responses

**Example**:
```java
import com.lg.microservice.admin.common.exception.RestCustomException;
import com.lg.microservice.admin.common.exception.RestCustomCode;

// Throw custom exception
throw new RestCustomException(List.of(
    new RestCustomCode("USER_NOT_FOUND", "User with ID 123 not found")
));
```

**Key Classes**:
- `RestCustomException`: Custom exception class
- `RestCustomCode`: Error code and message container
- `RestExceptionHandler`: Global exception handler
- `ErrorConstants`: Standard error constants

### 2. common.lib.correlation

**Purpose**: Correlation ID tracking for request tracing across microservices

**Usage**:
- Automatically extracts correlation ID from HTTP headers (`x-correlation-id`)
- Propagates correlation ID in logs and downstream service calls
- Logback configuration includes correlation ID in log patterns

**Log Pattern**:
```
%d{HH:mm:ss.SSS} [%thread] %X{x-session-id} %X{x-correlation-id} %X{x-request-id} %-5level %logger{} %message%n
```

**Integration**:
- Correlation ID is automatically included in Feign client requests
- Logs include correlation ID for traceability
- No manual code required - library handles it automatically

### 3. common.lib.flyway

**Purpose**: Database migration management

**Usage**:
- Flyway is integrated via this library
- Migration files located in `src/main/resources/flyway/common/` and `src/main/resources/flyway/env/{local,dev,qa,stg,prd}/`
- Format: `V{major}_{minor}_{patch}_{sequence}__{descriiption}.sql` (e.g., `V0_1_0_1__create_users_table.sql`)
- Baseline support for existing databases

**IMPORTANT: Migration Execution via API**:
- Flyway auto-migrate is **DISABLED** in production (`spring.flyway.enabled: false`)
- Migrations MUST be executed via API endpoint: `POST /flyway/migrate`
- This allows controlled migration timing during deployments
- The common.lib.flyway library provides the migration API endpoint

**Configuration** (application.yml):
```yaml
spring:
  flyway:
    enabled: false  # Auto-migrate disabled - use API endpoint
    url: jdbc:postgresql://${DB_HOST}:5432/${DB_NAME}
    user: ${DB_MGR_USER}
    password: ${DB_MGR_PASSWORD}
    schemas: public
    locations: classpath:flyway/common,classpath:flyway/env/${ENV_PATH:local}
    out-of-order: false  # Must follow sequence in qa/stg/prd
    validate-on-migrate: true
    baseline-on-migrate: true
    baseline-version: 0

# Per-profile overrides
---
spring:
  config:
    activate:
      on-profile: "DEV_CFG"
  flyway:
    locations: classpath:flyway/common,classpath:flyway/env/dev
    out-of-order: true  # Allow out-of-order in dev
```

### 4. common.lib.openapi

**Purpose**: OpenAPI/Swagger documentation generation

**Usage**:
- Automatically generates OpenAPI documentation from Spring controllers
- Swagger UI available at `/us/common/admin/swagger-ui/index.html`
- OpenAPI JSON at `/us/common/admin/openapi/v3/docs`

**Configuration** (application.yml):
```yaml
springdoc:
  api-docs:
    path: '/openapi/v3/docs'
  openapi:
    info:
      title: Admin Service APIs
      description: Microservices for handling Admin functionalities
```

### 5. common.lib.redis

**Purpose**: Redis caching integration

**Usage**:
- Use `@Cacheable` annotation from `common.lib.redis` on any method you want to cache
- Redis connection configured via Spring Data Redis
- Cache management handled automatically by the library

**Configuration** (application.yml):
```yaml
spring:
  data:
    redis:
      host: ${REDIS_HOST}
      port: ${REDIS_PORT}
```

**Example**:
```java
@Service
public class UserService {
    
    @Cacheable(value = "users", key = "#id")
    public User getUser(Long id) {
        return userRepository.findById(id).orElseThrow();
    }
}
```

**Key Points:**
- Simply add `@Cacheable` annotation to methods you want to cache
- The library handles all Redis operations automatically
- Cache keys are automatically generated based on method parameters (`key = "#id"`)

### 6. common.lib.requestmethod

**Purpose**: Support POST with action parameter for PUT/DELETE operations

**Usage**:
- Allows using POST requests with `_method` parameter for PUT/DELETE
- Swagger documentation still shows PUT/DELETE methods for security clarity
- Useful for environments where PUT/DELETE methods are restricted

**Example**:
```java
@RestController
@RequestMapping("/v1/admin/users")
public class UserController {
    
    // Swagger shows PUT, but accepts POST with _method=PUT
    @PutMapping("/{id}")
    public ResponseEntity<User> updateUser(@PathVariable Long id, @RequestBody UserDto dto) {
        // Implementation
    }
    
    // Swagger shows DELETE, but accepts POST with _method=DELETE
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        // Implementation
    }
}
```

**Note**: This library enables flexibility while maintaining RESTful API documentation standards.

---

## Database Schema Design

### Core Tables

**Important Note on Modular Auth Provider Design:**

The database schema is designed to support multiple authentication providers (Cognito, Auth0, Keycloak, etc.) without being tied to any specific provider. The system uses:
- **Single Provider Configuration**: Configured in `application.yml` - this is THE provider for all authentication
- **Token Validation**: All tokens are validated against the configured provider's JWK
- **External User ID**: The `external_user_id` field stores the user ID from the auth provider (e.g., Cognito's `sub` claim, Auth0's `sub` claim)

**Key Design Principles:**

1. **Single Provider Configuration**: One auth provider configured via `application.yml`:
   ```yaml
   auth:
     provider:
       type: cognito  # This is THE provider - all tokens must come from Cognito
   ```
   Used for:
   - Frontend login redirect (which provider's hosted UI to use)
   - Token validation (all tokens validated against this provider's JWK)
   - User creation (extract user info from validated tokens)

2. **Security-First Validation**: 
   - **Never trust token claims before validation** - security best practice
   - All tokens are validated against the configured provider's JWK first
   - Only after successful validation do we trust the token's claims (`sub`, `email`, etc.)
   - If validation fails → token is rejected (401 Unauthorized)

3. **No Provider Storage Per User**: The `auth_provider` field is not stored in the database because:
   - If config says Cognito, all tokens must be Cognito tokens
   - Each provider has unique `external_user_id` values, making it naturally unique
   - No need to track provider per user - it's determined by configuration

This design allows:
- Provider-agnostic user management
- Simple, secure token validation (validate against configured provider)
- Easy provider switching (change config, no database migration needed)
- Security-first approach (validate before trusting)

#### Users Table
```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    external_user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    -- User Activity Tracking
    last_login_at TIMESTAMP,
    last_activity_at TIMESTAMP,
    login_count INTEGER DEFAULT 0 NOT NULL
);

CREATE INDEX idx_users_external_user_id ON users(external_user_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(active);
CREATE INDEX idx_users_last_login_at ON users(last_login_at);
CREATE INDEX idx_users_last_activity_at ON users(last_activity_at);
```

**Schema Design Notes:**
- `external_user_id`: The user ID from the external auth provider (e.g., Cognito's `sub` claim, Auth0's `sub` claim)
- Unique constraint: Each provider has unique user IDs, so `external_user_id` is naturally unique across providers
- Provider identification: Provider is determined by application configuration (`auth.provider.type`), not from token
- All tokens are validated against the configured provider - if config says Cognito, all tokens must be Cognito tokens

**User Activity Tracking Fields:**
- `last_login_at`: Timestamp of the user's last successful login
- `last_activity_at`: Timestamp of the user's last activity (any API request)
- `login_count`: Total number of successful logins (incremented on each login)

#### Roles Table
```sql
CREATE TABLE roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_roles_name ON roles(name);
CREATE INDEX idx_roles_active ON roles(active);
```

#### Permissions Table
```sql
CREATE TABLE permissions (
    id BIGSERIAL PRIMARY KEY,
    permission_string VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_permissions_permission_string ON permissions(permission_string);
CREATE INDEX idx_permissions_resource_action ON permissions(resource, action);
```

#### User Roles Join Table
```sql
CREATE TABLE user_roles (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
```

#### Role Permissions Join Table
```sql
CREATE TABLE role_permissions (
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);
```

#### Audit Logs Table
```sql
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id BIGINT REFERENCES users(id),
    user_email VARCHAR(255),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(100),
    resource_id BIGINT,
    details JSONB,                    -- Detailed payload/changes (populated based on audit.detail-storage config)
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    success BOOLEAN DEFAULT TRUE NOT NULL,
    error_message TEXT,
    service_name VARCHAR(100),        -- For proxy operations
    endpoint VARCHAR(500),             -- API endpoint (for proxy operations)
    http_method VARCHAR(10),          -- HTTP method (for proxy operations)
    correlation_id VARCHAR(255)       -- Request correlation ID
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_correlation_id ON audit_logs(correlation_id);
CREATE INDEX idx_audit_logs_service_name ON audit_logs(service_name);
```

**Audit Logging Policy (IMPORTANT)**:

The system logs **two types of operations**:
1. **Database operations**: INSERT, UPDATE, DELETE on admin entities (User, Role, Permission)
2. **Proxy API operations**: Write operations (POST, PUT, PATCH, DELETE) to downstream services

**Operations NOT logged** (to avoid database bloat):
- SELECT/read queries on database
- GET requests to proxy services
- Read operations on admin APIs

| Operation Type | Logged Actions | Not Logged |
|----------------|----------------|------------|
| Database | INSERT, UPDATE, DELETE | SELECT |
| Proxy API | POST, PUT, PATCH, DELETE | GET |
| Admin API | POST, PUT, PATCH, DELETE | GET |

### Updated Timestamp Trigger

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Migration Strategy

- Use Flyway for version-controlled migrations
- Migration files: `V{version}__{description}.sql`
- Location: `src/main/resources/flyway/common/`
- Baseline support for existing databases
- Out-of-order migrations disabled for production safety

---

## API Specifications

### Base URL

**Backend Context Path:** `/us/common/admin`

### API Versioning

**All API endpoints use URL path versioning with `/v1` prefix.**

Following the order-service convention, all controllers use the version prefix:

```java
@RestController
@RequestMapping("/v1/auth")  // NOT /auth
public class AuthController { ... }

@RestController
@RequestMapping("/v1/admin/users")  // NOT /admin/users
public class UserController { ... }
```

**Version Format:** `/v{major}` (e.g., `/v1`, `/v2`)

**Why URL Path Versioning:**
- Explicit and visible in API calls
- Easy to route different versions to different services
- Consistent with LG microservice conventions (order-service, etc.)

### Frontend API Proxy

- Frontend requests: `/api/v1/{path}`
- Proxied to backend: `{BACKEND_URL}/us/common/admin/v1/{path}`
- See [Deployment Architecture](#deployment-architecture) for proxy configuration (Vite dev / Nginx prod)

**Examples:**
| Frontend Request | Backend Request |
|------------------|-----------------|
| `GET /api/v1/auth/me` | `GET {backend}/us/common/admin/v1/auth/me` |
| `GET /api/v1/admin/users` | `GET {backend}/us/common/admin/v1/admin/users` |
| `POST /api/v1/admin/roles` | `POST {backend}/us/common/admin/v1/admin/roles` |

### Authentication

**Token Handler Pattern (OAuth Proxy)**

This architecture implements the industry-standard **Token Handler Pattern**, also known as the **OAuth Proxy** pattern. Tokens are stored in **HttpOnly cookies** for security (XSS protection), and the **reverse proxy** (Vite/Nginx) converts them to `Authorization: Bearer` headers before forwarding to the backend.

**How it works:**
1. Auth endpoints set tokens in HttpOnly cookies (frontend can't read them)
2. Frontend sends requests with `withCredentials: true` (cookies auto-included)
3. **Proxy** extracts token from cookie and adds `Authorization: Bearer` header
4. Backend receives standard Bearer token - pure stateless REST API

```
┌──────────┐         ┌─────────────────┐         ┌──────────┐
│ Frontend │         │  Proxy (Vite/   │         │ Backend  │
│   SPA    │         │     Nginx)      │         │   API    │
└────┬─────┘         └────────┬────────┘         └────┬─────┘
     │                        │                       │
     │ GET /api/v1/admin/users│                       │
     │ Cookie: access_token=xyz                       │
     │───────────────────────>│                       │
     │                        │                       │
     │                        │ GET /us/common/admin/v1/admin/users
     │                        │ Authorization: Bearer xyz
     │                        │──────────────────────>│
     │                        │                       │
     │                        │         200 OK        │
     │                        │<──────────────────────│
     │       200 OK           │                       │
     │<───────────────────────│                       │
```

**Why this pattern (Industry Standard):**
- Used by **Curity**, **Duende BFF**, **Spring Cloud Gateway**, and major API gateways
- Backend is 100% decoupled - only validates `Authorization: Bearer` header
- Works with any OAuth2 Resource Server configuration
- Tokens never exposed to JavaScript (XSS protection)
- No backend code changes needed for cookie handling

**Cookie Policy:**
- `HttpOnly: true` - Prevents JavaScript access (XSS protection)
- `Secure: true` - HTTPS only in production
- `SameSite: Lax` - Allows cookies on navigation, prevents CSRF on POST
- Two cookies: `access_token` (1hr), `refresh_token` (30 days)

**Proxy Configuration:** See [Deployment Architecture](#deployment-architecture) for Vite (dev) and Nginx (prod) proxy configuration with token injection.

#### Auth Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/me` | GET | Check authentication status, returns user info |
| `/api/v1/auth/login` | GET | **Default**: Initiate OIDC redirect flow (Cognito Hosted UI) |
| `/api/v1/auth/login` | POST | *Reserved*: For future custom login UI (not used by default) |
| `/api/v1/auth/callback` | GET | Handle OIDC callback, exchange code, set cookies |
| `/api/v1/auth/change-password` | GET | Redirect to Cognito Hosted UI for password change |
| `/api/v1/auth/logout` | POST | Clear auth cookies, invalidate session |
| `/api/v1/auth/refresh` | POST | Refresh access token using refresh token cookie |

> **Framework Default**: Frontend uses `GET /api/v1/auth/login` exclusively (Cognito Hosted UI redirect flow). The `POST /api/v1/auth/login` endpoint is implemented in the backend for extensibility but is not used by the default frontend implementation.

**GET `/api/v1/auth/login` Query Parameters (Default Flow):**
- `return_to` - URL to redirect after successful login (default: `/`)
- `ui_mode` - `redirect` (full page) or `popup` (for popup login windows)

**POST `/api/v1/auth/login` Request Body (Reserved for Custom UI):**
```json
{
  "username": "user@example.com",
  "password": "password123"
}
```
> **Note**: This endpoint is implemented but not used by the default frontend. Use this only if implementing a custom login form instead of Cognito Hosted UI.

**GET `/api/v1/auth/me` Response:**
```json
{
  "data": {
    "id": "123",
    "email": "user@example.com",
    "name": "John Doe",
    "roles": ["ADMIN", "USER"],
    "permissions": ["users:read", "users:write"]
  }
}
```

**401 Response (Not Authenticated):**
```json
{
  "errors": [
    {
      "code": "UNAUTHENTICATED",
      "message": "Authentication required"
    }
  ]
}
```

### API Endpoints

#### User Management

- `GET /api/v1/admin/users` - List users (paginated, filtered, sorted)
- `GET /api/v1/admin/users/{id}` - Get user details
- `POST /api/v1/admin/users` - Create user (creates in Cognito + local DB)
- `PUT /api/v1/admin/users/{id}` - Update user
- `DELETE /api/v1/admin/users/{id}` - Delete user (deletes from Cognito + local DB)
- `POST /api/v1/admin/users/{id}/roles` - Assign roles to user
- `DELETE /api/v1/admin/users/{id}/roles/{roleId}` - Remove role from user
- `POST /api/v1/admin/users/sync` - Sync users from Cognito

#### Role Management

- `GET /api/v1/admin/roles` - List roles
- `GET /api/v1/admin/roles/{id}` - Get role details
- `POST /api/v1/admin/roles` - Create role
- `PUT /api/v1/admin/roles/{id}` - Update role
- `DELETE /api/v1/admin/roles/{id}` - Delete role
- `POST /api/v1/admin/roles/{id}/permissions` - Assign permissions to role
- `DELETE /api/v1/admin/roles/{id}/permissions/{permissionId}` - Remove permission from role

#### Permission Management

- `GET /api/v1/admin/permissions` - List permissions
- `POST /api/v1/admin/permissions` - Create permission
- `PUT /api/v1/admin/permissions/{id}` - Update permission
- `DELETE /api/v1/admin/permissions/{id}` - Delete permission

#### Audit Logs

- `GET /api/v1/admin/audit-logs` - List audit logs (paginated, filtered, sorted)
- `GET /api/v1/admin/audit-logs/{id}` - Get audit log details
- `GET /api/v1/admin/audit-logs/export` - Export audit logs (CSV/JSON)
- `DELETE /api/v1/admin/audit-logs/archive` - Archive old audit logs (admin only)

#### Service Proxy

Services are hardcoded in the backend. Each service has dedicated endpoints:

- `GET /api/{service-name}/**` - Proxy GET requests
- `POST /api/{service-name}/**` - Proxy POST requests
- `PUT /api/{service-name}/**` - Proxy PUT requests
- `DELETE /api/{service-name}/**` - Proxy DELETE requests

**Example**: For a hardcoded "user-service":
- `GET /api/user-service/users` - Proxy to user service
- `POST /api/user-service/users` - Proxy to user service

### Response Format

The backend uses standardized response wrappers from `common/response/`.

#### Single Item Response (`DataResponse<T>`)

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Item Name",
    "description": "Description",
    "status": "ACTIVE",
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T10:30:00Z"
  },
  "message": "Operation successful"
}
```

#### Paginated Response (`PageResponse<T>`)

```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Item 1", ... },
    { "id": 2, "name": "Item 2", ... }
  ],
  "page": {
    "number": 0,
    "size": 10,
    "totalElements": 25,
    "totalPages": 3
  }
}
```

**Page Metadata Fields:**
| Field | Description |
|-------|-------------|
| `number` | Current page number (0-based) |
| `size` | Items per page |
| `totalElements` | Total items across all pages |
| `totalPages` | Total number of pages |

#### Error Response (`ErrorResponse`)

```json
{
  "success": false,
  "errors": [
    {
      "code": "USER_NOT_FOUND",
      "message": "User with ID 123 not found"
    }
  ],
  "timestamp": "2025-01-15T10:30:00Z"
}
```

#### Frontend API Response Handling

The frontend API layer transforms backend responses to match the expected format for TanStack Query hooks:

```typescript
// src/domain/{module}/api/{resource}.api.ts

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

// Transform for list queries
export const getItems = async (params: ListParams): Promise<PaginatedResult<Item>> => {
  const response = await apiClient.get<PagedResponse<Item>>('/api/v1/items', { params });
  
  // Transform to format expected by data table components
  return {
    content: response.data.data,           // Items array
    totalPages: response.data.page.totalPages,
    totalElements: response.data.page.totalElements,
    number: response.data.page.number,
    size: response.data.page.size,
  };
};
```
```

### Pagination

All list endpoints support pagination:
- `page`: Page number (default: 1)
- `size`: Page size (default: 20, max: 100)
- `sort`: Sort field and direction (e.g., `sort=email,asc`)

### Filtering

Filtering is supported via query parameters:
- `filter[field]=value` - Filter by field
- `filter[field][gte]=value` - Greater than or equal
- `filter[field][lte]=value` - Less than or equal

---

## Frontend Implementation

### Authentication Flow

**BFF (Backend-for-Frontend) Pattern**: The frontend is **provider-agnostic**. All authentication logic is handled by the backend. The frontend only interacts with `/api/v1/auth/*` endpoints.

#### Authentication Implementation

1. **Provider-Agnostic Frontend**
   - Frontend knows nothing about Cognito, Magento, or OIDC internals
   - Backend handles all OAuth2/OIDC complexity and multi-provider routing
   - Switching auth providers requires only backend configuration changes

2. **Token Storage**
   - **Access token**: Stored in Zustand memory (never localStorage, never cookies)
   - **Refresh token**: HttpOnly cookie (survives page refresh, XSS-proof)
   - All API calls include `Authorization: Bearer {accessToken}` header

3. **Auth Store (Zustand)**
   ```typescript
   // src/framework/core/auth/stores/authStore.ts
   interface User {
     id: string;
     email: string;
     name: string;
     roles: string[];
     permissions: string[];
   }

   interface AuthState {
     accessToken: string | null;        // Token in memory
     isAuthenticated: boolean;
     user: User | null;
     isLoading: boolean;
     setAccessToken: (token: string) => void;
     checkAuth: () => Promise<void>;    // POST /auth/refresh → GET /auth/me
     logout: () => Promise<void>;       // POST /auth/logout
   }
   ```

4. **Login Flow (Regular)**
   - Redirect to `/api/v1/auth/login?return_to=/dashboard`
   - OAuth callback sets refresh_token cookie + redirects to frontend
   - On page load: `POST /auth/refresh` → returns accessToken in JSON body
   - Store accessToken in Zustand → `GET /auth/me` for user info
   - SPA navigations skip refresh (token already in memory)

5. **Embed Mode Flow**
   - URL includes `?embed&token=eyJ...`
   - `initEmbedMode()` extracts token, stores in Zustand, strips from URL
   - `FramelessLayout` renders (no sidebar/header)
   - On 401: `postMessage(TOKEN_REFRESH)` to parent iframe
   - Parent generates new JWT → `postMessage(TOKEN_REFRESHED, { token })`

6. **HTTP Client Configuration**
   ```typescript
   // Request interceptor: inject Bearer header
   apiClient.interceptors.request.use((config) => {
     const token = useAuthStore.getState().accessToken;
     if (token) config.headers.Authorization = `Bearer ${token}`;
     return config;
   });

   // Response interceptor: handle 401
   apiClient.interceptors.response.use(
     (response) => response,
     async (error) => {
       if (error.response?.status === 401 && !originalRequest._retry) {
         if (isEmbedMode()) {
           // Request new token from parent via postMessage
           const newToken = await requestTokenFromParent();
           useAuthStore.getState().setAccessToken(newToken);
         } else {
           // Refresh via backend
           const res = await apiClient.post('/auth/refresh');
           useAuthStore.getState().setAccessToken(res.data.data.accessToken);
         }
         return apiClient(originalRequest); // Retry
       }
       return Promise.reject(error);
     }
   );
   ```

7. **Layout Selection**
   - `isEmbedMode()` returns true if `?embed` was in URL on boot
   - Root route: `isEmbedMode() ? <FramelessLayout /> : <MainLayout />`
   - Same routes, different layouts — no duplication

### State Management

#### Global State (Zustand)
- Authentication state
- User preferences (language)
- UI state (sidebar collapsed, etc.)

#### Server State (TanStack Query)
- API data caching
- Automatic refetching
- Optimistic updates
- Background synchronization

#### Module State (Zustand per module)
- Module-specific UI state
- Form state (can use React Hook Form)
- Local component state

### Component Structure

#### ShadCN UI Components
- Components copied to `src/shared/components/ui/`
- Fully customizable (copy-paste model)
- Built on Radix UI primitives
- Tailwind CSS styling

#### Layout Components
- `MainLayout`: Main application layout with SidebarProvider (regular mode)
- `FramelessLayout`: Minimal layout for embed mode (no sidebar/header, just `<Outlet />` with padding)
- `AppSidebar`: Collapsible sidebar using ShadCN Sidebar components, integrates with auto-discovery navigation
- `Breadcrumb`: Dynamic breadcrumb navigation based on current route
- Uses ShadCN Sidebar primitives: `SidebarProvider`, `SidebarInset`, `SidebarTrigger`

#### Toast Notifications

ShadCN Toast is used for user feedback notifications. No provider wrapper is needed - just add the `<Toaster />` component to the app layout.

**Setup:**

```tsx
// src/App.tsx or AppLayout.tsx
import { Toaster } from '@/shared/components/ui/toaster';

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
```

**Usage:**

```tsx
import { useToast } from '@/shared/components/ui/use-toast';

export function MyComponent() {
  const { toast } = useToast();

  const handleSuccess = () => {
    toast({
      title: 'Success',
      description: 'Operation completed successfully',
    });
  };

  const handleError = (error: Error) => {
    toast({
      title: 'Error',
      description: error.message,
      variant: 'destructive',
    });
  };
}
```

**Variants:**

| Variant | Usage |
|---------|-------|
| `default` | General info/success messages |
| `destructive` | Error messages |

> **Note**: ShadCN Toast has two built-in variants. For warning/info distinction, use the title/description text or extend with custom variants if needed.

### Routing

```typescript
// React Router configuration
<Routes>
  <Route path="/" element={<MainLayout />}>
    <Route index element={<Home />} />
    <Route path="users" element={<UserList />} />
    <Route path="users/:id" element={<UserDetail />} />
    {/* Lazy loaded modules */}
    <Route path="module-a/*" element={<ModuleA />} />
  </Route>
</Routes>
```

### Code Splitting

```typescript
// Lazy load modules
const ModuleA = lazy(() => import('@modules/module-a/pages/ModuleA'));
const ModuleB = lazy(() => import('@modules/module-b/pages/ModuleB'));
```

---

## CRUDL Standard Pattern

> **Canonical Reference**: The Sample Items module (`src/domain/sample/sub-menu/items/`) is the reference implementation for all CRUDL pages. All new domain modules MUST follow this pattern.

Every CRUDL module consists of a **List Page** and a **Form Page** (unified Create/Edit/View). Together they provide a complete data management experience with search, filtering, sorting, column visibility, bulk actions, row actions, and pagination.

### Module File Structure

Each domain module follows a minimal, flat structure with 2 page files:

```
src/domain/{service}/{sub-path}/
├── menu.tsx              # Menu configuration (sidebar entry)
├── routes.tsx            # Route definitions
├── api/
│   └── {resource}.api.ts # API functions (plain async, not hooks)
└── pages/
    ├── index.tsx          # List page (table with all features)
    └── {Resource}Form.tsx # Unified Create/Edit/View form
```

**Key principle**: Pages are self-contained. Column definitions, table configuration, and mutations live directly in the page file — NOT in separate component files.

### Non-CRUDL Modules (Custom Pages)

Some modules are not CRUDL and use custom UI flows. These still follow the same module discovery conventions (`menu.tsx` + `routes.tsx`) but may include additional supporting components and utilities.

**Agentic System (Domain Module):**
- Menu: `src/domain/agentic-system/menu.tsx`
- Routes:
  - `/agentic-system/kpi-monitor`
  - `/agentic-system/compliance-dashboard`
- Compliance Dashboard uses custom components (project table, history, prompt-injection panel, data-source editor) and connects to a dedicated compliance service API.

### Standard Route Pattern

All CRUDL modules use three routes:

| Route | Purpose | Component |
|-------|---------|-----------|
| `/{module-path}` | List page | `pages/index.tsx` |
| `/{module-path}/new` | Create form | `pages/{Resource}Form.tsx` |
| `/{module-path}/:id` | Edit form (default) / View form (with `?mode=view`) | `pages/{Resource}Form.tsx` |

**Route configuration example:**
```typescript
// routes.tsx
const SampleItemsListPage = lazy(() => import('./pages/index'));
const SampleItemFormPage = lazy(() => import('./pages/SampleItemForm'));

const routes: RouteConfig[] = [
  {
    path: '/sample/sub-menu/items',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <LazyPage><SampleItemsListPage /></LazyPage>
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/sample/sub-menu/items/new',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <LazyPage><SampleItemFormPage /></LazyPage>
        </MainLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/sample/sub-menu/items/:id',
    element: (
      <ProtectedRoute>
        <MainLayout>
          <LazyPage><SampleItemFormPage /></LazyPage>
        </MainLayout>
      </ProtectedRoute>
    ),
  },
];
```

**View mode**: The same `:id` route handles both Edit and View. View mode is activated via query param `?mode=view`. The form detects this and disables all inputs.

### Standard API Layer

API functions are plain `async` functions (NOT custom hooks). TanStack Query `useQuery`/`useMutation` is called inline in the page component.

```typescript
// api/{resource}.api.ts
import apiClient from "@shared/lib/axios";

// Types
export type SampleItem = {
  id: number;
  name: string;
  description: string;
  status: SampleItemStatus;
  createdAt: string;
  updatedAt: string;
};

export type GetSampleItemsParams = {
  page?: number;
  size?: number;
  status?: string;
  query?: string;
  sort?: string;
};

// List (paginated, filtered, sorted)
export const getSampleItems = async ({ page = 0, size = 10, status, query, sort }: GetSampleItemsParams) => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('size', size.toString());
  if (status && status !== 'all') params.append('status', status);
  if (query) params.append('query', query);
  if (sort) params.append('sort', sort);

  const response = await apiClient.get<PagedResponse<SampleItem>>(`/sample/items?${params.toString()}`);
  return {
    content: response.data.data,
    totalPages: response.data.page.totalPages,
    totalElements: response.data.page.totalElements,
    size: response.data.page.size,
    number: response.data.page.number,
  };
};

// Get single item
export const getSampleItem = async (id: number | string) => {
  const response = await apiClient.get<DataResponse<SampleItem>>(`/sample/items/${id}`);
  return response.data;
};

// Create
export const createSampleItem = async (data: Partial<SampleItem>) => {
  const response = await apiClient.post<DataResponse<SampleItem>>('/sample/items', data);
  return response.data;
};

// Update
export const updateSampleItem = async ({ id, data }: { id: number | string; data: Partial<SampleItem> }) => {
  const response = await apiClient.put<DataResponse<SampleItem>>(`/sample/items/${id}`, data);
  return response.data;
};

// Delete single
export const deleteSampleItem = async (id: number | string) => {
  await apiClient.delete(`/sample/items/${id}`);
};

// Delete bulk
export const deleteSampleItems = async (ids: (number | string)[]) => {
  await apiClient.delete('/sample/items', { data: { ids } });
};
```

---

## Standard List Page Pattern

All list pages MUST include the following features. The Sample Items list page (`src/domain/sample/sub-menu/items/pages/index.tsx`) is the canonical reference.

### Required Features Checklist

| Feature | Required | Description |
|---------|:--------:|-------------|
| Search (debounced text input) | YES | `InputGroup` with search icon, clear button, 500ms debounce |
| Status filter (dropdown) | YES | `Select` dropdown filtering by status enum |
| Column visibility (toggle + persist) | YES | `DropdownMenu` with per-column checkboxes, persisted to `localStorage` |
| Bulk actions (select + bulk delete) | YES | Checkbox column, conditional delete button, `AlertDialog` confirmation |
| Row actions (View, Edit, Delete) | YES | Eye/Pen/Trash icons per row with inline delete confirmation |
| Server-side sorting | YES | `SortableHeader` component, `manualSorting: true` |
| Pagination | YES | `PaginationControl` component |
| Create button | YES | Primary button navigating to `./new` |
| Selection count footer | YES | `"N of M row(s) selected."` text |

### Standard Page Layout

Every list page follows this visual structure:

```
┌────────────────────────────────────────────────────────────────┐
│ Header Row                                                     │
│ ┌─────────────────────────┐     ┌────────────────────────────┐ │
│ │ Page Title (h1)         │     │ [Bulk Delete] [Create]     │ │
│ └─────────────────────────┘     └────────────────────────────┘ │
├────────────────────────────────────────────────────────────────┤
│ Table Controls Row                                             │
│ ┌──────────────────────┐ ┌──────────────┐      ┌────────────┐  │
│ │ [🔍 Search...      ✕] │ │ [Status ▾]   │      │ [Columns ▾]│  │
│ └──────────────────────┘ └──────────────┘      └────────────┘  │
│ └──────── left (search + filters) ───────┘     └── right ───┘  │
├────────────────────────────────────────────────────────────────┤
│ Data Table (with sortable column headers)                      │
│ ┌──┬─────┬──────┬─────────────┬────────┬───────────┬────────┐  │
│ │☐ │ ID▲ │ Name │ Description │ Status │ Created At│ Actions│  │
│ ├──┼─────┼──────┼─────────────┼────────┼───────────┼────────┤  │
│ │☐ │ 1   │ ...  │ ...         │ ACTIVE │ 1/1/2025  │ 👁 ✏ 🗑│  │
│ │☐ │ 2   │ ...  │ ...         │INACTIVE│ 1/2/2025  │ 👁 ✏ 🗑│  │
│ └──┴─────┴──────┴─────────────┴────────┴───────────┴────────┘  │
├────────────────────────────────────────────────────────────────┤
│ Footer Row                                                     │
│ "2 of 10 row(s) selected."               [< 1 2 3 ... 5 >]     │
└────────────────────────────────────────────────────────────────┘
```

**Layout Rules:**
- **Header Row**: Page title (left) + action buttons (right: Bulk Delete when items selected, Create button)
- **Table Controls Row**: Search + filters (left) | Column visibility dropdown (far right, visually separated)
- **Data Table**: Checkbox column, sortable headers, row actions
- **Footer Row**: Selection count (left) + pagination (right)

### Complete List Page Implementation Reference

The following sections break down each feature with the exact code pattern used.

### Search UI

Debounced text search using `InputGroup` with search icon and clear button:

```typescript
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@shared/components/ui/input-group";
import { SearchIcon, XIcon } from "lucide-react";
import debounce from "lodash/debounce";

// State
const [query, setQuery] = useState("");
const searchInputRef = useRef<HTMLInputElement>(null);

const handleClear = () => {
  const el = searchInputRef.current;
  if (!el) return;
  el.value = "";
  setQuery("");
  el.focus();
};

// JSX
<InputGroup className="w-[360px]">
  <InputGroupInput
    placeholder="Search items..."
    onChange={debounce((e) => setQuery(e.target.value), 500)}
    ref={searchInputRef}
  />
  <InputGroupAddon>
    <SearchIcon />
  </InputGroupAddon>
  <InputGroupAddon align="inline-end">
    <InputGroupButton onClick={handleClear} size="icon-xs" aria-label="Clear">
      <XIcon />
    </InputGroupButton>
  </InputGroupAddon>
</InputGroup>
```

**Key details:**
- 500ms debounce via `lodash/debounce` prevents excessive API calls
- `ref` on input allows programmatic clearing without controlled component overhead
- Clear button (`XIcon`) resets both the input value and query state
- `query` is included in the TanStack Query key to trigger automatic refetch

### Status Filter UI

Status dropdown using ShadCN `Select`:

```typescript
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/components/ui/select";

// State
const [statusFilter, setStatusFilter] = useState<"all" | "ACTIVE" | "INACTIVE" | "PENDING" | "ARCHIVED">("all");

// JSX
<Select
  defaultValue="all"
  value={statusFilter}
  onValueChange={(val) => setStatusFilter(val)}
>
  <SelectTrigger className="w-auto min-w-[120px]">
    <SelectValue placeholder="Select status" />
  </SelectTrigger>
  <SelectContent className="w-auto min-w-[120px]">
    <SelectItem value="all">All Status</SelectItem>
    <SelectItem value="ACTIVE">Active</SelectItem>
    <SelectItem value="INACTIVE">Inactive</SelectItem>
    <SelectItem value="PENDING">Pending</SelectItem>
    <SelectItem value="ARCHIVED">Archived</SelectItem>
  </SelectContent>
</Select>
```

**Key details:**
- `"all"` value means no filter applied (backend ignores `status=all`)
- Status enum values match backend exactly (uppercase)
- `statusFilter` is included in the TanStack Query key

### Column Visibility

Column visibility toggle with `DropdownMenu`, persisted to `localStorage`:

```typescript
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@shared/components/ui/dropdown-menu";
import { ChevronDown, RotateCcwIcon } from "lucide-react";
import type { VisibilityState } from "@tanstack/react-table";

const COLUMN_VISIBILITY_KEY = "sample-items-column-visibility";  // Unique per page

// State (initialized from localStorage)
const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
  const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY);
  return saved ? JSON.parse(saved) : {};
});

// Persist on change
useEffect(() => {
  localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility));
}, [columnVisibility]);

// Reset function
const resetColumnVisibility = () => {
  setColumnVisibility({});
  localStorage.removeItem(COLUMN_VISIBILITY_KEY);
};

// Table config
const table = useReactTable({
  // ...
  onColumnVisibilityChange: setColumnVisibility,
  state: { sorting, rowSelection, columnVisibility },
});

// JSX
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" className="ml-auto">
      Columns <ChevronDown className="ml-2 h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    {table.getAllColumns()
      .filter((column) => column.getCanHide())
      .map((column) => (
        <DropdownMenuCheckboxItem
          key={column.id}
          className="capitalize"
          checked={column.getIsVisible()}
          onCheckedChange={(value) => column.toggleVisibility(!!value)}
        >
          {column.id}
        </DropdownMenuCheckboxItem>
      ))}
    <DropdownMenuSeparator />
    <div className="px-2 py-1.5">
      <Button variant="ghost" size="sm" className="w-full justify-start" onClick={resetColumnVisibility}>
        <RotateCcwIcon className="mr-2 h-4 w-4" />
        Reset to Default
      </Button>
    </div>
  </DropdownMenuContent>
</DropdownMenu>
```

**Key details:**
- Each page uses a unique `localStorage` key (e.g., `"sample-items-column-visibility"`, `"users-page-column-visibility"`)
- Columns with `enableHiding: false` (select, actions) are excluded from the toggle
- "Reset to Default" clears both state and `localStorage`

### Row Actions (View, Edit, Delete)

Each row has three action buttons in an actions column:

```typescript
import { EyeIcon, SquarePenIcon, Trash2Icon } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@shared/components/ui/alert-dialog";

// Column definition
{
  id: "actions",
  header: "Actions",
  enableHiding: false,  // Always visible
  cell: ({ row }) => (
    <div className="flex items-center gap-1">
      {/* View - navigates to /:id?mode=view */}
      <NavLink to={`./${row.original.id}?mode=view`}>
        <Button size="icon" variant="ghost" title="View">
          <EyeIcon className="h-4 w-4" />
        </Button>
      </NavLink>

      {/* Edit - navigates to /:id */}
      <NavLink to={`./${row.original.id}`}>
        <Button size="icon" variant="ghost" title="Edit">
          <SquarePenIcon className="h-4 w-4" />
        </Button>
      </NavLink>

      {/* Delete - inline AlertDialog confirmation */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="icon" variant="ghost" title="Delete">
            <Trash2Icon className="h-4 w-4 text-destructive" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => deleteItemMutation.mutate(row.original.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  ),
}
```

**Key details:**
- View uses `?mode=view` query param on the same form route
- Edit navigates to `/:id` (no query param — edit is default)
- Delete uses inline `AlertDialog` (not a separate dialog component)
- Actions column has `enableHiding: false` so it can't be toggled off
- Delete icon uses `text-destructive` color

### Server-Side Sorting

Sorting is handled server-side. The frontend sends sort parameters to the backend, which returns pre-sorted data.

#### Sort Parameter Format

All list endpoints accept a `sort` query parameter in the format `fieldName,direction`:

| Example | Meaning |
|---------|---------|
| `sort=name,asc` | Sort by name ascending |
| `sort=id,desc` | Sort by ID descending (default) |
| `sort=createdAt,asc` | Sort by creation date ascending |

#### Frontend Sorting Flow

```
Column Header Click → SortingState Update → Query Key Change → API Refetch → Sorted Data
```

**1. Sorting State (TanStack Table `SortingState`):**
```typescript
const [sorting, setSorting] = useState<SortingState>([]);
```

**2. Sort Parameter Construction:**
```typescript
const sortParam = sorting.length > 0
  ? `${sorting[0].id},${sorting[0].desc ? "desc" : "asc"}`
  : undefined;
```

**3. TanStack Query Integration (sort in queryKey triggers refetch):**
```typescript
const { data, refetch } = useQuery({
  queryKey: ["items", { query, statusFilter, currPage, sortParam }],
  queryFn: () => getItems({ query, status: statusFilter, page: currPage - 1, size: 10, sort: sortParam }),
  placeholderData: (prev) => prev,
});
```

**4. TanStack Table Configuration:**
```typescript
const table = useReactTable({
  data: itemList,
  columns,
  manualSorting: true,           // Backend handles sorting, not client-side
  onSortingChange: setSorting,   // Update state on column header click
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel(),
  state: { sorting, rowSelection, columnVisibility },
});
```

**5. SortableHeader Component (reusable column header with sort icons):**
```typescript
function SortableHeader<T>({ column, children }: { column: Column<T, unknown>; children: React.ReactNode }) {
  if (!column.getCanSort()) return <span>{children}</span>;
  return (
    <Button variant="ghost" size="sm" className="-ml-3 h-8"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
      {children}
      {column.getIsSorted() === "asc" ? (
        <ArrowUpIcon className="ml-2 h-4 w-4" />
      ) : column.getIsSorted() === "desc" ? (
        <ArrowDownIcon className="ml-2 h-4 w-4" />
      ) : (
        <ArrowUpDownIcon className="ml-2 h-4 w-4 opacity-50" />
      )}
    </Button>
  );
}
```

**6. Column Definition (per-column sort control):**
```typescript
const columns: ColumnDef<SampleItem>[] = [
  { id: "select", /* ... checkbox ... */, enableSorting: false, enableHiding: false },
  { accessorKey: "id", header: ({ column }) => <SortableHeader column={column}>ID</SortableHeader> },
  { accessorKey: "name", header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader> },
  { accessorKey: "description", header: "Description", enableSorting: false },  // Not sortable
  { accessorKey: "status", header: ({ column }) => <SortableHeader column={column}>Status</SortableHeader> },
  { accessorKey: "createdAt", header: ({ column }) => <SortableHeader column={column}>Created At</SortableHeader> },
  { id: "actions", header: "Actions", enableHiding: false },
];
```

#### Backend Sorting Flow

```
Controller (parse sort param) → Service → FeignClient → Mock/External Service (apply sort)
```

**Sort Parameter Parsing (Controller layer):**
```java
String[] sortParams = sort.split(",");
Sort.Direction direction = sortParams.length > 1 && "asc".equalsIgnoreCase(sortParams[1])
        ? Sort.Direction.ASC : Sort.Direction.DESC;
Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortParams[0]));
```

**Mock Data Store Sorting (in-memory comparators):**
```java
private Comparator<SampleItemDto> getFieldComparator(String field) {
    return switch (field) {
        case "id" -> Comparator.comparingLong(SampleItemDto::id);
        case "name" -> Comparator.comparing(SampleItemDto::name, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
        case "status" -> Comparator.comparing(item -> item.status().name());
        case "createdAt" -> Comparator.comparing(SampleItemDto::createdAt, Comparator.nullsLast(Comparator.naturalOrder()));
        case "updatedAt" -> Comparator.comparing(SampleItemDto::updatedAt, Comparator.nullsLast(Comparator.naturalOrder()));
        default -> null;
    };
}
```

### Server-Side Filtering

List endpoints support text search and status filtering via query parameters.

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | String | Case-insensitive substring search across name and description fields |
| `status` | String | Filter by status enum value (e.g., `ACTIVE`, `INACTIVE`, `PENDING`, `ARCHIVED`). Use `all` for no filter |

**Frontend:** Search input (`InputGroup`) and status dropdown (`Select`) update query parameters, which are included in the TanStack Query key to trigger automatic refetch. See [Search UI](#search-ui) and [Status Filter UI](#status-filter-ui) sections above for implementation details.

**Backend (Mock Data Store):**
```java
// Status filtering
if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
    SampleItemStatus statusEnum = SampleItemStatus.valueOf(status.toUpperCase());
    filtered = filtered.stream()
            .filter(item -> item.status() == statusEnum)
            .collect(Collectors.toList());
}

// Text search filtering (case-insensitive, across name + description)
if (query != null && !query.isBlank()) {
    String lowerQuery = query.toLowerCase();
    filtered = filtered.stream()
            .filter(item ->
                    (item.name() != null && item.name().toLowerCase().contains(lowerQuery)) ||
                    (item.description() != null && item.description().toLowerCase().contains(lowerQuery)))
            .collect(Collectors.toList());
}
```

### Bulk Actions (Row Selection + Bulk Delete)

List pages support selecting multiple rows via checkboxes and performing bulk operations.

#### Frontend Bulk Action Flow

```
Checkbox Select → rowSelection State → Bulk Delete Button (conditional) → Confirmation Dialog → Mutation → Refetch
```

**1. Row Selection State:**
```typescript
const [rowSelection, setRowSelection] = useState({});
const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
```

**2. Select Column (checkbox in first column):**
```typescript
{
  id: "select",
  header: ({ table }) => (
    <Checkbox
      checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      aria-label="Select all"
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(value) => row.toggleSelected(!!value)}
      aria-label="Select row"
    />
  ),
  enableSorting: false,
  enableHiding: false,
}
```

**3. TanStack Table Configuration:**
```typescript
const table = useReactTable({
  data: itemList,
  columns,
  onRowSelectionChange: setRowSelection,
  state: { sorting, rowSelection, columnVisibility },
});
```

**4. Selected Row Tracking:**
```typescript
const selectedItems = table.getFilteredSelectedRowModel().rows.map(row => row.original);
const selectedItemIds = selectedItems.map(item => item.id);
```

**5. Conditional Bulk Delete Button (shown only when rows are selected):**
```typescript
{selectedItemIds.length > 0 && (
  <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
    <AlertDialogTrigger asChild>
      <Button variant="destructive">
        <Trash2Icon className="mr-2 h-4 w-4" />
        Delete ({selectedItemIds.length})
      </Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete {selectedItemIds.length} Item(s)?</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to delete {selectedItemIds.length} selected item(s)? This action cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          className={buttonVariants({ variant: "destructive" })}
          onClick={handleBulkDelete}
          disabled={bulkDeleteMutation.isPending}
        >
          {bulkDeleteMutation.isPending && <Spinner className="mr-2 h-4 w-4" />}
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)}
```

**6. Bulk Delete Mutation:**
```typescript
const bulkDeleteMutation = useMutation({
  mutationFn: deleteSampleItems,
  onSuccess: (_, deletedIds) => {
    toast.success(`${deletedIds.length} item(s) deleted successfully`);
    setRowSelection({});  // Clear selection after delete
    refetch();
  },
  onError: () => {
    toast.error("Failed to delete items");
  },
});

const handleBulkDelete = () => {
  bulkDeleteMutation.mutate(selectedItemIds);
  setBulkDeleteOpen(false);
};
```

#### API Layer - Bulk Delete Strategies

Two strategies are used depending on whether the downstream service supports bulk endpoints:

**Strategy 1: Single Bulk Endpoint (Sample Items)**
```typescript
export const deleteSampleItems = async (ids: (number | string)[]) => {
  await apiClient.delete('/sample/items', { data: { ids } });
};
```

**Strategy 2: Parallel Individual Deletes (Users)**
```typescript
export const deleteUsers = async (ids: (number | string)[]) => {
  await Promise.all(ids.map(id => apiClient.delete(`/admin/users/${id}`)));
  return ids;
};
```

> **Note**: Strategy 1 is preferred when the downstream service supports it. Strategy 2 is a fallback for services that only expose single-item delete endpoints.

### Pagination

Server-side pagination using a shared `PaginationControl` component:

```typescript
import { PaginationControl } from "@core/components/PaginationControl";

// State (1-indexed for display, converted to 0-indexed for API)
const [currPage, setCurrPage] = useState(1);
const totalPage = data?.totalPages || 0;

// API call uses 0-indexed page
queryFn: () => getItems({ page: currPage - 1, size: 10, /* ... */ }),

// JSX (in footer row)
<div className="flex items-center justify-between space-x-2 py-4">
  <div className="text-sm text-muted-foreground">
    {table.getFilteredSelectedRowModel().rows.length} of{" "}
    {table.getFilteredRowModel().rows.length} row(s) selected.
  </div>
  <PaginationControl {...{ totalPage, currPage, setCurrPage }} />
</div>
```

**Key details:**
- Frontend uses 1-indexed pages, API uses 0-indexed (subtract 1 before sending)
- `PaginationControl` is a shared framework component from `@core/components/`
- The selection count and pagination control sit in the same footer row

### Complete TanStack Table Configuration

The full `useReactTable` configuration combining all features:

```typescript
const table = useReactTable({
  data: itemList,
  columns,
  manualSorting: true,                        // Server-side sorting
  onSortingChange: setSorting,                // Sort state handler
  onRowSelectionChange: setRowSelection,      // Row selection handler
  onColumnVisibilityChange: setColumnVisibility, // Column visibility handler
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel(),
  state: {
    sorting,            // Current sort state
    rowSelection,       // Current row selection state
    columnVisibility,   // Current column visibility state
  },
});
```

---

## Standard Form Page Pattern (Create / Edit / View)

All CRUDL modules use a single unified form component that handles Create, Edit, and View modes.

### Mode Detection

The form determines its mode from the URL:

```typescript
const { id } = useParams();
const [searchParams] = useSearchParams();

const mode = searchParams.get("mode") === "view" ? "view" : id ? "edit" : "create";
const isViewMode = mode === "view";
const isEditMode = mode === "edit";
```

| URL | Mode | Behavior |
|-----|------|----------|
| `/items/new` | Create | Empty form, submit creates |
| `/items/5` | Edit | Pre-populated form, submit updates |
| `/items/5?mode=view` | View | Pre-populated form, all fields disabled, "Edit" button shown |

### Form Structure

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@shared/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/components/ui/card";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "PENDING", "ARCHIVED"]),
});

type FormValues = z.infer<typeof formSchema>;

export const SampleItemForm = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mode = searchParams.get("mode") === "view" ? "view" : id ? "edit" : "create";
  const isViewMode = mode === "view";
  const isEditMode = mode === "edit";

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "", status: "ACTIVE" },
  });

  // Fetch existing item for Edit/View modes
  const { data: existingItem, isLoading } = useQuery({
    queryKey: ["sampleItem", id],
    queryFn: () => getSampleItem(id!),
    enabled: !!id,
  });

  // Populate form when data loads
  useEffect(() => {
    if (existingItem?.data) {
      form.reset({
        name: existingItem.data.name,
        description: existingItem.data.description,
        status: existingItem.data.status,
      });
    }
  }, [existingItem, form]);

  // Mutation handles both Create and Update
  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (isEditMode) return updateSampleItem({ id: id!, data: values });
      return createSampleItem(values);
    },
    onSuccess: () => {
      toast.success(isEditMode ? "Item updated successfully" : "Item created successfully");
      queryClient.invalidateQueries({ queryKey: ["sampleItems"] });
      navigate("/sample/sub-menu/items");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save item: ${error.message}`);
    },
  });

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{isViewMode ? "View Item" : isEditMode ? "Edit Item" : "Create New Item"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
              {/* Form fields with disabled={isViewMode} */}

              {/* View mode: show additional read-only info (ID, timestamps) */}
              {isViewMode && existingItem?.data && (
                <div className="space-y-4 rounded-lg border p-4">
                  <h3 className="text-base font-medium">Additional Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">ID</span>
                      <p className="font-medium">{existingItem.data.id}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created At</span>
                      <p className="font-medium">{new Date(existingItem.data.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer buttons */}
              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => navigate("/sample/sub-menu/items")}>
                  {isViewMode ? "Back to List" : "Cancel"}
                </Button>
                {isViewMode ? (
                  <Button type="button" onClick={() => navigate(`/sample/sub-menu/items/${id}`)}>
                    Edit
                  </Button>
                ) : (
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending && <Spinner className="mr-2 h-4 w-4" />}
                    {isEditMode ? "Update Item" : "Create Item"}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};
```

### Form Pattern Key Details

| Aspect | Pattern |
|--------|---------|
| **Validation** | Zod schema + `zodResolver` for React Hook Form |
| **Layout** | `Card` > `CardHeader` + `CardContent` > `Form` > fields |
| **Field disabling** | `disabled={isViewMode}` on each input |
| **View-only info** | Additional info block (ID, timestamps) shown only in view mode |
| **Navigation on success** | `navigate()` back to list page after create/update |
| **Toast feedback** | `toast.success()` / `toast.error()` via Sonner |
| **Loading state** | `Spinner` inside submit button while `mutation.isPending` |
| **Query invalidation** | `queryClient.invalidateQueries({ queryKey: ["items"] })` on success |

---

## Backend Implementation

### Service Layer

The service layer handles all business logic and orchestrates interactions between repositories, external services, and the domain layer.

### Security Implementation

Spring Security with OAuth2 Resource Server pattern is used for JWT validation and role-based access control.

---

## Admin Module CRUDL - Backend Implementation

### User Management Backend

The backend provides full CRUD operations for user management with Cognito integration.

### Audit Log Implementation

The audit logging system automatically captures all write operations without requiring manual code changes. The system uses AOP (Aspect-Oriented Programming) interceptors to automatically log operations.

**Configuration**

Detailed logging storage is configurable via `application.yml`:

```yaml
audit:
  detail-storage: file  # Options: 'db' or 'file'
  # db: Store all details (including payloads/changes) in database
  # file: Store minimal info in DB, detailed logs go to application logs (New Relic)
```

#### 1. Database Operation Interceptor

Intercepts JPA/Hibernate operations on auditable entities:

```java
// src/main/java/com/lg/microservice/admin/shared/infrastructure/audit/DatabaseAuditInterceptor.java
@Component
public class DatabaseAuditInterceptor extends EmptyInterceptor {
    
    private final AuditLogRepository auditLogRepository;
    private final HttpServletRequest httpServletRequest;
    private final ObjectMapper objectMapper;
    
    @Value("${audit.detail-storage:file}")
    private String detailStorage; // 'db' or 'file'
    
    @Override
    public boolean onSave(Object entity, Serializable id, Object[] state, 
                         String[] propertyNames, Type[] types) {
        if (isAuditableEntity(entity)) {
            logDatabaseOperation("CREATE", entity, id, null, state, propertyNames);
        }
        return false;
    }
    
    @Override
    public boolean onFlushDirty(Object entity, Serializable id, Object[] currentState,
                               Object[] previousState, String[] propertyNames, Type[] types) {
        if (isAuditableEntity(entity)) {
            logDatabaseOperation("UPDATE", entity, id, previousState, currentState, propertyNames);
        }
        return false;
    }
    
    @Override
    public void onDelete(Object entity, Serializable id, Object[] state,
                        String[] propertyNames, Type[] types) {
        if (isAuditableEntity(entity)) {
            logDatabaseOperation("DELETE", entity, id, state, null, propertyNames);
        }
    }
    
    private void logDatabaseOperation(String action, Object entity, Serializable id,
                                     Object[] beforeState, Object[] afterState,
                                     String[] propertyNames) {
        // Extract minimal info for DB
        AuditLog auditLog = new AuditLog();
        auditLog.setAction(action);
        auditLog.setResourceType(entity.getClass().getSimpleName());
        auditLog.setResourceId(id != null ? Long.valueOf(id.toString()) : null);
        auditLog.setTimestamp(LocalDateTime.now());
        
        // Extract user from Security Context
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserDetails) {
            UserDetails userDetails = (UserDetails) auth.getPrincipal();
            auditLog.setUserId(extractUserId(userDetails));
            auditLog.setUserEmail(extractUserEmail(userDetails));
        }
        
        // Extract request metadata
        if (httpServletRequest != null) {
            auditLog.setIpAddress(getClientIpAddress(httpServletRequest));
            auditLog.setUserAgent(httpServletRequest.getHeader("User-Agent"));
            auditLog.setCorrelationId(httpServletRequest.getHeader("X-Correlation-ID"));
        }
        
        // Calculate changes for UPDATE operations
        Map<String, Object> changes = null;
        if ("UPDATE".equals(action) && beforeState != null && afterState != null) {
            changes = calculateChanges(beforeState, afterState, propertyNames);
        }
        
        // Store details based on configuration
        if ("db".equalsIgnoreCase(detailStorage)) {
            // DB mode: Store all details in database
            Map<String, Object> details = new HashMap<>();
            if (changes != null) {
                details.put("changes", changes);
            }
            if (afterState != null && "CREATE".equals(action)) {
                details.put("created", buildEntityMap(afterState, propertyNames));
            }
            if (beforeState != null && "DELETE".equals(action)) {
                details.put("deleted", buildEntityMap(beforeState, propertyNames));
            }
            auditLog.setDetails(details);
        } else {
            // File mode: Store minimal info in DB, log details to application logs
            auditLog.setDetails(null); // No details in DB
            
            // Log detailed info to application logs (structured JSON for New Relic)
            Map<String, Object> detailedLog = new HashMap<>();
            detailedLog.put("action", action);
            detailedLog.put("resourceType", entity.getClass().getSimpleName());
            detailedLog.put("resourceId", id);
            detailedLog.put("userId", auditLog.getUserId());
            detailedLog.put("userEmail", auditLog.getUserEmail());
            detailedLog.put("correlationId", auditLog.getCorrelationId());
            
            if (changes != null) {
                detailedLog.put("changes", changes);
            }
            if (afterState != null && "CREATE".equals(action)) {
                detailedLog.put("created", buildEntityMap(afterState, propertyNames));
            }
            if (beforeState != null && "DELETE".equals(action)) {
                detailedLog.put("deleted", buildEntityMap(beforeState, propertyNames));
            }
            
            log.info("AUDIT_DB_OPERATION: {}", objectMapper.writeValueAsString(detailedLog));
        }
        
        auditLog.setSuccess(true);
        auditLogRepository.save(auditLog);
    }
    
    private Map<String, Object> calculateChanges(Object[] before, Object[] after, String[] propertyNames) {
        Map<String, Object> changes = new HashMap<>();
        for (int i = 0; i < propertyNames.length; i++) {
            if (!Objects.equals(before[i], after[i])) {
                changes.put(propertyNames[i], Map.of(
                    "from", before[i] != null ? before[i].toString() : null,
                    "to", after[i] != null ? after[i].toString() : null
                ));
            }
        }
        return changes;
    }
    
    private Map<String, Object> buildEntityMap(Object[] state, String[] propertyNames) {
        Map<String, Object> entityMap = new HashMap<>();
        for (int i = 0; i < propertyNames.length; i++) {
            if (state[i] != null) {
                entityMap.put(propertyNames[i], state[i].toString());
            }
        }
        return entityMap;
    }
    
    private boolean isAuditableEntity(Object entity) {
        return entity instanceof User || 
               entity instanceof Role || 
               entity instanceof Permission;
    }
    
    private String getClientIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
```

#### 2. API Proxy Interceptor (AOP)

Intercepts service proxy calls to log external API operations:

```java
// src/main/java/com/lg/microservice/admin/shared/infrastructure/audit/ProxyAuditAspect.java
@Aspect
@Component
public class ProxyAuditAspect {
    
    private final AuditLogRepository auditLogRepository;
    private final HttpServletRequest httpServletRequest;
    private final ObjectMapper objectMapper;
    
    @Value("${audit.detail-storage:file}")
    private String detailStorage; // 'db' or 'file'
    
    // Pointcut for write operations on REST controllers
    @Pointcut("execution(* com.lg.microservice.admin.domain.*.interfaces.rest..*(..)) && " +
              "(@annotation(org.springframework.web.bind.annotation.PostMapping) || " +
              "@annotation(org.springframework.web.bind.annotation.PutMapping) || " +
              "@annotation(org.springframework.web.bind.annotation.DeleteMapping))")
    public void proxyWriteOperations() {}
    
    @Around("proxyWriteOperations()")
    public Object auditProxyOperation(ProceedingJoinPoint joinPoint) throws Throwable {
        HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder
            .currentRequestAttributes()).getRequest();
        
        String httpMethod = request.getMethod();
        String endpoint = request.getRequestURI();
        String serviceName = extractServiceName(endpoint);
        
        // Extract request body if available
        Object requestBody = extractRequestBody(joinPoint.getArgs());
        
        // Extract user info
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Long userId = null;
        String userEmail = null;
        if (auth != null && auth.getPrincipal() instanceof UserDetails) {
            UserDetails userDetails = (UserDetails) auth.getPrincipal();
            userId = extractUserId(userDetails);
            userEmail = extractUserEmail(userDetails);
        }
        
        // Execute the proxy operation
        Object response = null;
        boolean success = true;
        String errorMessage = null;
        
        try {
            response = joinPoint.proceed();
            
            // Store audit log
            AuditLog auditLog = new AuditLog();
            auditLog.setAction(httpMethod);
            auditLog.setResourceType("ExternalAPI");
            auditLog.setServiceName(serviceName);
            auditLog.setEndpoint(endpoint);
            auditLog.setHttpMethod(httpMethod);
            auditLog.setUserId(userId);
            auditLog.setUserEmail(userEmail);
            auditLog.setTimestamp(LocalDateTime.now());
            auditLog.setSuccess(true);
            
            if (httpServletRequest != null) {
                auditLog.setIpAddress(getClientIpAddress(httpServletRequest));
                auditLog.setUserAgent(httpServletRequest.getHeader("User-Agent"));
                auditLog.setCorrelationId(httpServletRequest.getHeader("X-Correlation-ID"));
            }
            
            // Store details based on configuration
            if ("db".equalsIgnoreCase(detailStorage)) {
                // DB mode: Store all details in database
                Map<String, Object> details = new HashMap<>();
                details.put("requestPayload", requestBody);
                details.put("responsePayload", response);
                auditLog.setDetails(details);
            } else {
                // File mode: Store minimal info in DB, log details to application logs
                auditLog.setDetails(null); // No details in DB
                
                // Log detailed info to application logs (structured JSON for New Relic)
                Map<String, Object> detailedLog = new HashMap<>();
                detailedLog.put("action", httpMethod);
                detailedLog.put("serviceName", serviceName);
                detailedLog.put("endpoint", endpoint);
                detailedLog.put("userId", userId);
                detailedLog.put("userEmail", userEmail);
                detailedLog.put("correlationId", auditLog.getCorrelationId());
                detailedLog.put("requestPayload", requestBody);
                detailedLog.put("responsePayload", response);
                detailedLog.put("success", true);
                
                log.info("AUDIT_PROXY_OPERATION: {}", objectMapper.writeValueAsString(detailedLog));
            }
            
            auditLogRepository.save(auditLog);
            return response;
            
        } catch (Exception e) {
            success = false;
            errorMessage = e.getMessage();
            
            // Store error audit log
            AuditLog auditLog = new AuditLog();
            auditLog.setAction(httpMethod);
            auditLog.setResourceType("ExternalAPI");
            auditLog.setServiceName(serviceName);
            auditLog.setEndpoint(endpoint);
            auditLog.setHttpMethod(httpMethod);
            auditLog.setUserId(userId);
            auditLog.setUserEmail(userEmail);
            auditLog.setSuccess(false);
            auditLog.setErrorMessage(errorMessage);
            auditLog.setTimestamp(LocalDateTime.now());
            
            if (httpServletRequest != null) {
                auditLog.setIpAddress(getClientIpAddress(httpServletRequest));
                auditLog.setUserAgent(httpServletRequest.getHeader("User-Agent"));
                auditLog.setCorrelationId(httpServletRequest.getHeader("X-Correlation-ID"));
            }
            
            // Store details based on configuration
            if ("db".equalsIgnoreCase(detailStorage)) {
                // DB mode: Store all details in database
                Map<String, Object> details = new HashMap<>();
                details.put("requestPayload", requestBody);
                details.put("error", errorMessage);
                auditLog.setDetails(details);
            } else {
                // File mode: Store minimal info in DB, log details to application logs
                auditLog.setDetails(null); // No details in DB
                
                // Log detailed error to application logs
                Map<String, Object> detailedLog = new HashMap<>();
                detailedLog.put("action", httpMethod);
                detailedLog.put("serviceName", serviceName);
                detailedLog.put("endpoint", endpoint);
                detailedLog.put("userId", userId);
                detailedLog.put("userEmail", userEmail);
                detailedLog.put("correlationId", auditLog.getCorrelationId());
                detailedLog.put("requestPayload", requestBody);
                detailedLog.put("error", errorMessage);
                detailedLog.put("success", false);
                
                log.error("AUDIT_PROXY_OPERATION: {}", objectMapper.writeValueAsString(detailedLog), e);
            }
            
            auditLogRepository.save(auditLog);
            throw e;
        }
    }
    
    private String extractServiceName(String endpoint) {
        // Extract service name from /api/{service-name}/...
        String[] parts = endpoint.split("/");
        if (parts.length > 2) {
            return parts[2];
        }
        return "unknown";
    }
    
    private Object extractRequestBody(Object[] args) {
        for (Object arg : args) {
            if (arg != null && !(arg instanceof HttpServletRequest) && 
                !(arg instanceof HttpServletResponse)) {
                return arg;
            }
        }
        return null;
    }
    
    private String getClientIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
```

#### 3. AuditLogService (Query Only)

Service only provides query methods - no manual logging:

```java
// src/main/java/com/lg/microservice/admin/domain/admin/application/service/AuditLogService.java
@Service
@Transactional(readOnly = true)
public class AuditLogService {
    
    private final AuditLogRepository auditLogRepository;
    
    public Page<AuditLogDto> getAuditLogs(AuditLogListParams params, Pageable pageable) {
        Specification<AuditLog> spec = buildSpecification(params);
        Page<AuditLog> logs = auditLogRepository.findAll(spec, pageable);
        return logs.map(this::toDto);
    }
    
    public AuditLogDto getAuditLog(Long id) {
        AuditLog log = auditLogRepository.findById(id)
            .orElseThrow(() -> new RestCustomException(
                ErrorCode.AUDIT_LOG_NOT_FOUND,
                "Audit log with ID " + id + " not found"
            ));
        return toDto(log);
    }
    
    private Specification<AuditLog> buildSpecification(AuditLogListParams params) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            
            if (params.getUserId() != null) {
                predicates.add(cb.equal(root.get("userId"), params.getUserId()));
            }
            
            if (params.getAction() != null) {
                predicates.add(cb.equal(root.get("action"), params.getAction()));
            }
            
            if (params.getResourceType() != null) {
                predicates.add(cb.equal(root.get("resourceType"), params.getResourceType()));
            }
            
            if (params.getStartDate() != null) {
                predicates.add(cb.greaterThanOrEqualTo(
                    root.get("timestamp"),
                    params.getStartDate()
                ));
            }
            
            if (params.getEndDate() != null) {
                predicates.add(cb.lessThanOrEqualTo(
                    root.get("timestamp"),
                    params.getEndDate()
                ));
            }
            
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
    
    private AuditLogDto toDto(AuditLog auditLog) {
        AuditLogDto dto = new AuditLogDto();
        dto.setId(auditLog.getId());
        dto.setTimestamp(auditLog.getTimestamp());
        dto.setUserId(auditLog.getUserId());
        dto.setUserEmail(auditLog.getUserEmail());
        dto.setAction(auditLog.getAction());
        dto.setResourceType(auditLog.getResourceType());
        dto.setResourceId(auditLog.getResourceId());
        dto.setDetails(auditLog.getDetails()); // May be null if detail-storage=file
        dto.setIpAddress(auditLog.getIpAddress());
        dto.setUserAgent(auditLog.getUserAgent());
        dto.setSuccess(auditLog.getSuccess());
        dto.setErrorMessage(auditLog.getErrorMessage());
        dto.setServiceName(auditLog.getServiceName());
        dto.setEndpoint(auditLog.getEndpoint());
        dto.setHttpMethod(auditLog.getHttpMethod());
        dto.setCorrelationId(auditLog.getCorrelationId());
        return dto;
    }
}
```

#### 4. Application Configuration

```yaml
# application.yml
audit:
  # Detail storage mode: 'db' or 'file'
  # - 'db': Store all details (including payloads/changes) in database
  # - 'file': Store minimal info in DB, detailed logs go to application logs (New Relic)
  detail-storage: file  # Default: file

logging:
  pattern:
    console: "%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n"
  level:
    com.lg.microservice.admin.audit: INFO
```

#### 5. Hibernate Configuration

Register the interceptor:

```java
// src/main/java/com/lg/microservice/admin/shared/infrastructure/config/HibernateConfig.java
@Configuration
public class HibernateConfig {
    
    @Bean
    public HibernatePropertiesCustomizer hibernatePropertiesCustomizer(
        DatabaseAuditInterceptor auditInterceptor
    ) {
        return hibernateProperties -> {
            hibernateProperties.put("hibernate.session_factory.interceptor", auditInterceptor);
        };
    }
}
```

#### 6. Summary of Automatic Audit Logging

**Key Points:**
- **No manual logging**: All audit logging is automatic via AOP interceptors - no code changes needed in services
- **Database operations**: Automatically logged via Hibernate interceptor for User, Role, Permission entities
- **API proxy operations**: Automatically logged via AOP aspect for POST, PUT, DELETE proxy calls
- **Configurable detail storage**: Choose 'db' or 'file' mode via `audit.detail-storage` in `application.yml`
  - **DB mode** (`audit.detail-storage: db`): All details (payloads, changes) stored in database `details` JSONB field
  - **File mode** (`audit.detail-storage: file`): Minimal info in DB (`details` field is null), detailed logs go to application logs (New Relic picks up)
- **No view operations**: Only CREATE, UPDATE, DELETE operations are logged (no GET/read operations to avoid database bloat)
- **Correlation ID**: Automatically captured from `X-Correlation-ID` header for request tracing
- **User context**: Automatically extracted from Spring Security context
- **Request metadata**: IP address, user agent automatically captured

**Example Log Output:**

**DB Mode** (`audit.detail-storage: db`):
- Database stores: `{ "changes": { "firstName": { "from": "John", "to": "Jonathan" } } }`
- Application logs: Standard application logs

**File Mode** (`audit.detail-storage: file`):
- Database stores: `details = null`
- Application logs: `AUDIT_DB_OPERATION: {"action":"UPDATE","resourceType":"User","resourceId":789,"changes":{"firstName":{"from":"John","to":"Jonathan"}},...}`
- New Relic picks up application logs for detailed analysis

---

## Authentication & Authorization

### OAuth2/OIDC Flow with Cognito

The backend implements a complete OAuth2 Authorization Code Flow with PKCE for secure authentication.

#### Token Types and Their Usage

**IMPORTANT**: Cognito returns three tokens, each with different purposes:

| Token | Purpose | Contains | Used For |
|-------|---------|----------|----------|
| **Access Token** | API Authorization | `sub`, `scope`, `client_id` | Bearer token for API requests |
| **ID Token** | User Identity | `sub`, `email`, `given_name`, `family_name` | User profile extraction |
| **Refresh Token** | Token Renewal | Opaque | Obtaining new access tokens |

**Key Insight**: User profile claims (`email`, `given_name`, `family_name`) are in the **ID Token**, NOT the Access Token. The Access Token only contains authorization-related claims.

#### OAuth Callback Flow

During the OAuth callback (`/v1/auth/callback`), the backend:

1. **Exchanges authorization code** for tokens (access, id, refresh)
2. **Decodes ID token** to extract user profile claims
3. **Syncs user to database** with profile data (email, firstName, lastName)
4. **Sets HttpOnly cookies** with access and refresh tokens
5. **Redirects** user to the application

```
Cognito Hosted UI → Authorization Code → Backend Callback
                                              │
                                              ▼
                                    Exchange code for tokens
                                              │
                                              ▼
                                    TokenResponse {
                                      accessToken,
                                      idToken,      ← Contains user profile
                                      refreshToken
                                    }
                                              │
                                              ▼
                                    Decode ID Token (Nimbus JWT)
                                              │
                                              ▼
                                    Extract claims: sub, email, given_name, family_name
                                              │
                                              ▼
                                    UserSyncService.syncUserFromIdToken()
                                              │
                                              ▼
                                    Set cookies & redirect to /
```

#### User Sync Service

The `UserSyncService` handles user creation and updates from token claims:

```java
@Transactional
public User syncUserFromIdToken(String externalUserId, String email, String firstName, String lastName) {
    // Find or create user by external ID (Cognito sub)
    // Update profile if claims have changed
    // Handle race conditions with DataIntegrityViolationException
}
```

**Race Condition Handling**: If concurrent requests attempt to create the same user, the service catches `DataIntegrityViolationException` and returns the existing user instead of failing.

#### /auth/me Endpoint

The `/v1/auth/me` endpoint:

1. Validates access token from cookie (via Spring Security OAuth2 Resource Server)
2. Looks up user by `externalUserId` (from JWT `sub` claim)
3. Falls back to `syncUserFromJwt()` if user not found (limited profile data)
4. Returns user info with roles and permissions

**Note**: Since user sync now happens during callback, `/auth/me` typically just looks up the already-synced user.

### Cookie Configuration

| Cookie | HttpOnly | Secure | SameSite | Max-Age | Path |
|--------|----------|--------|----------|---------|------|
| `access_token` | true | true | Strict | 1 hour | / |
| `refresh_token` | true | true | Strict | 30 days | / |

### JWT Validation

Access tokens are validated using Spring Security OAuth2 Resource Server:

- **JWK Validation**: Tokens validated against Cognito's JWKS endpoint
- **Issuer Validation**: Must match configured Cognito User Pool issuer
- **Audience Validation**: Must match configured client ID

---

## Service Proxy Pattern

### Overview

The admin backend acts as an authorized gateway to downstream microservices. The architecture uses a **layered proxy pattern** with Spring Cloud OpenFeign that separates concerns and follows order-service conventions:

```
┌─────────────────────────────────────────────────────────────────────┐
│                       CONTROLLER LAYER                               │
│  SampleController, CommunicationController, OrderController, etc.   │
│  @RequestMapping("/v1/{service}")                                    │
│  - Thin: Routes requests to Service interface                        │
│  - HTTP mapping only                                                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SERVICE INTERFACE LAYER                         │
│  SampleService, CommunicationService, OrderService (interfaces)     │
│  - Defines the contract for each domain                              │
│  - Enables mocking for unit tests                                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SERVICE IMPLEMENTATION LAYER                      │
│  SampleServiceImpl, CommunicationServiceImpl (@Service)             │
│  - Implements service interface                                      │
│  - Calls FeignClient                                                 │
│  - Hook for authorization (Phase 6: @PreAuthorize on methods)       │
│  - Hook for audit logging (Phase 8: AOP on service methods)         │
│  - Can add caching, transformation, validation                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FEIGN CLIENT LAYER                              │
│  SampleFeignClient, CommunicationFeignClient (@FeignClient)         │
│  - Declarative HTTP interface                                        │
│  - Type-safe method signatures                                       │
│  - AuthorizationFeignInterceptor propagates headers                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL/MOCK SERVICES                            │
│  /mock/sample/** (SampleMockController - internal mock endpoint)    │
│  Communication Service (external microservice)                       │
│  Order Service (external microservice)                               │
└─────────────────────────────────────────────────────────────────────┘
```

### Why This Architecture?

**Core Principle: Controllers are THIN - ALL logic lives in Service layer**

- Controllers only handle HTTP concerns (request/response mapping, status codes)
- ALL business logic lives in ServiceImpl (validation, transformation, orchestration, caching)
- Services ALWAYS have interface + impl separation (for testability and flexibility)
- What ServiceImpl calls depends on the use case:
  - External microservice → FeignClient
  - Database → Repository  
  - Another domain → Another Service
  - Multiple of the above → Orchestrate in ServiceImpl

| Concern | Layer | Benefit |
|---------|-------|---------|
| HTTP routing | Controller | Thin controllers, REST API mapping only |
| Testability | Service Interface | Can mock service in unit tests |
| **ALL business logic** | **ServiceImpl** | **Caching, validation, transformation, orchestration** |
| Authorization | ServiceImpl | `@PreAuthorize` on methods (Phase 6) |
| Audit logging | ServiceImpl | AOP on service layer (Phase 8) |
| HTTP mechanics | FeignClient | Declarative, type-safe HTTP calls |
| Header propagation | FeignInterceptor | Authorization, Correlation-ID forwarded |
| Mock/Real switch | Configuration | Same code path, different URLs |

### Package Structure (MANDATORY for all domain services)

```
com.lg.microservice.admin/
├── common/
│   └── config/
│       └── AuthorizationFeignInterceptor.java  # Propagates Authorization header
└── domain/
    ├── sample/                                 # Reference implementation
    │   ├── controller/
    │   │   ├── SampleController.java           # /v1/sample/** → SampleService
    │   │   └── SampleMockController.java       # /mock/sample/** → in-memory data
    │   ├── service/
    │   │   ├── SampleService.java              # Service interface
    │   │   └── impl/
    │   │       └── SampleServiceImpl.java      # @Service, calls FeignClient
    │   ├── feign/
    │   │   └── SampleFeignClient.java          # Feign client interface
    │   ├── dto/
    │   │   └── ...                             # Request/Response DTOs
    │   └── store/
    │       └── SampleMockDataStore.java        # In-memory store (for mock only)
    └── communication/                          # External service integration
        ├── controller/
        │   └── CommunicationController.java
        ├── service/
        │   ├── CommunicationService.java
        │   └── impl/
        │       └── CommunicationServiceImpl.java
        └── feign/
            └── CommunicationFeignClient.java
```

### Microservice Configuration Convention

Downstream services are configured using the `microservice:` config block:

```yaml
# Default configuration (shared across all profiles)
microservice:
  host: http://microservice.lgcomus-dev.lge.com
  sample: ${microservice.host}/us/common/admin/mock/sample    # Points to mock for LOCAL
  communication: ${microservice.host}/us/common/communication/v1
  # order: ${microservice.host}/us/common/order/v1           # Add new services here

# Feign client configuration
feign:
  client:
    config:
      default:
        connectTimeout: 5000
        readTimeout: 60000
        loggerLevel: basic

# Per-profile host overrides
---
spring:
  config:
    activate:
      on-profile: "LOCAL_CFG"
microservice:
  host: http://microservice.lgcomus-dev.lge.com
  sample: http://localhost:8080/us/common/admin/mock/sample   # Local mock

---
spring:
  config:
    activate:
      on-profile: "DEV_CFG"
microservice:
  host: http://microservice.lgcomus-dev.lge.com

---
spring:
  config:
    activate:
      on-profile: "QA_CFG"
microservice:
  host: http://microservice.lgcomus-qa.lge.com

---
spring:
  config:
    activate:
      on-profile: "STG_CFG"
microservice:
  host: http://microservice.lgcomus-stg.lge.com

---
spring:
  config:
    activate:
      on-profile: "PRD_CFG"
microservice:
  host: http://microservice.lgcomus-prd.lge.com
```

### Controller → Service → ServiceImpl → FeignClient Pattern

**Step 1: FeignClient (HTTP Interface)**

```java
@FeignClient(
    name = "SampleFeignClient",
    url = "${microservice.sample}",
    configuration = AuthorizationFeignInterceptor.class
)
public interface SampleFeignClient {
    
    @GetMapping("/items")
    PageResponse<SampleItemDto> getItems(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "all") String status,
            @RequestParam(defaultValue = "id,desc") String sort);
    
    @GetMapping("/items/{id}")
    DataResponse<SampleItemDto> getItem(@PathVariable("id") Long id);
    
    @PostMapping("/items")
    DataResponse<SampleItemDto> createItem(@RequestBody CreateSampleItemRequest request);
    
    @PutMapping("/items/{id}")
    DataResponse<SampleItemDto> updateItem(@PathVariable("id") Long id, @RequestBody UpdateSampleItemRequest request);
    
    @DeleteMapping("/items/{id}")
    void deleteItem(@PathVariable("id") Long id);
}
```

**Step 2: Service Interface**

```java
public interface SampleService {
    PageResponse<SampleItemDto> getItems(int page, int size, String query, String status, String sort);
    DataResponse<SampleItemDto> getItem(Long id);
    DataResponse<SampleItemDto> createItem(CreateSampleItemRequest request);
    DataResponse<SampleItemDto> updateItem(Long id, UpdateSampleItemRequest request);
    void deleteItem(Long id);
}
```

**Step 3: Service Implementation**

```java
@Slf4j
@RequiredArgsConstructor
@Service
public class SampleServiceImpl implements SampleService {
    
    private final SampleFeignClient sampleFeignClient;
    
    @Override
    // Phase 6: @PreAuthorize("hasPermission(null, 'sample:read')")
    public PageResponse<SampleItemDto> getItems(int page, int size, String query, String status, String sort) {
        return sampleFeignClient.getItems(page, size, query, status, sort);
    }
    
    @Override
    // Phase 6: @PreAuthorize("hasPermission(null, 'sample:read')")
    public DataResponse<SampleItemDto> getItem(Long id) {
        return sampleFeignClient.getItem(id);
    }
    
    @Override
    // Phase 6: @PreAuthorize("hasPermission(null, 'sample:write')")
    public DataResponse<SampleItemDto> createItem(CreateSampleItemRequest request) {
        return sampleFeignClient.createItem(request);
    }
    
    @Override
    // Phase 6: @PreAuthorize("hasPermission(null, 'sample:write')")
    public DataResponse<SampleItemDto> updateItem(Long id, UpdateSampleItemRequest request) {
        return sampleFeignClient.updateItem(id, request);
    }
    
    @Override
    // Phase 6: @PreAuthorize("hasPermission(null, 'sample:delete')")
    public void deleteItem(Long id) {
        sampleFeignClient.deleteItem(id);
    }
}
```

**Step 4: Controller**

```java
@RestController
@RequestMapping("/v1/sample")
@RequiredArgsConstructor
@Tag(name = "Sample Service", description = "Sample service proxy - Reference implementation")
public class SampleController {
    
    private final SampleService sampleService;
    
    @Operation(summary = "List sample items")
    @GetMapping("/items")
    public ResponseEntity<PageResponse<SampleItemDto>> getItems(
            @Parameter(description = "Search query") @RequestParam(defaultValue = "") String query,
            @Parameter(description = "Status filter") @RequestParam(defaultValue = "all") String status,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort field and direction (e.g. 'name,asc')") @RequestParam(defaultValue = "id,desc") String sort) {
        return ResponseEntity.ok(sampleService.getItems(page, size, query, status, sort));
    }
    
    @Operation(summary = "Get sample item by ID")
    @GetMapping("/items/{id}")
    public ResponseEntity<DataResponse<SampleItemDto>> getItem(@PathVariable Long id) {
        return ResponseEntity.ok(sampleService.getItem(id));
    }
    
    @Operation(summary = "Create sample item")
    @PostMapping("/items")
    public ResponseEntity<DataResponse<SampleItemDto>> createItem(@RequestBody CreateSampleItemRequest request) {
        return ResponseEntity.ok(sampleService.createItem(request));
    }
    
    @Operation(summary = "Update sample item")
    @PutMapping("/items/{id}")
    public ResponseEntity<DataResponse<SampleItemDto>> updateItem(
            @PathVariable Long id, @RequestBody UpdateSampleItemRequest request) {
        return ResponseEntity.ok(sampleService.updateItem(id, request));
    }
    
    @Operation(summary = "Delete sample item")
    @DeleteMapping("/items/{id}")
    public ResponseEntity<Void> deleteItem(@PathVariable Long id) {
        sampleService.deleteItem(id);
        return ResponseEntity.noContent().build();
    }
}
```

### URL Flow Examples

| Frontend Request | Controller | Service | FeignClient | Downstream |
|------------------|------------|---------|-------------|------------|
| `GET /api/v1/sample/items?sort=name,asc&query=widget&status=ACTIVE` | `SampleController` | `sampleService.getItems()` | `sampleFeignClient.getItems()` | `/mock/sample/items` |
| `POST /api/v1/sample/items` | `SampleController` | `sampleService.createItem()` | `sampleFeignClient.createItem()` | `/mock/sample/items` |
| `GET /api/v1/communication/templates` | `CommunicationController` | `communicationService.getTemplates()` | `communicationFeignClient.getTemplates()` | External service |

### Sample Mock Service (Full Proxy Simulation)

The sample service demonstrates the **complete proxy flow** by having:

1. **SampleController** (`/v1/sample/**`) - Uses SampleService like any real service integration
2. **SampleMockController** (`/mock/sample/**`) - Simulates an external service with in-memory data

This ensures the full proxy path is tested: Controller → Service → ServiceImpl → FeignClient → HTTP → Mock

```
Frontend → /api/v1/sample/items
               ↓
         SampleController.getItems()
               ↓
         sampleService.getItems(page, size)
               ↓
         SampleServiceImpl.getItems()
               ↓
         sampleFeignClient.getItems(page, size)
               ↓
         HTTP Request to http://localhost:8080/.../mock/sample/items
               ↓
         SampleMockController.getItems() → in-memory data
               ↓
         HTTP Response
               ↓
         Return to frontend
```

**Mock Data Store:**
- Pre-populated with 15 sample items across multiple statuses (ACTIVE, INACTIVE, PENDING, ARCHIVED)
- Supports full CRUD operations
- Supports server-side sorting (by id, name, status, createdAt, updatedAt), text search (name, description), and status filtering
- Resets on application restart
- Demonstrates realistic pagination, filtering, sorting, and error responses

### Audit Logging for Service Operations

**IMPORTANT**: Only write operations are logged to avoid database bloat (per PRD requirements).

| HTTP Method | Logged | Reason |
|-------------|--------|--------|
| GET | NO | Read operations not logged |
| POST | YES | Write operation |
| PUT | YES | Write operation |
| PATCH | YES | Write operation |
| DELETE | YES | Write operation |

Audit log entries for service operations include:
- Service name
- HTTP method
- Request path
- User ID and email
- Timestamp
- Response status and duration
- Correlation ID for distributed tracing

### Adding a New Service Integration

To add a new service (e.g., "order"):

1. **Add configuration** to `application.yml`:
   ```yaml
   microservice:
     services:
       order:
         base-url: ${microservice.host}/us/common/order/v1
   ```

2. **Create controller** at `domain/order/controller/OrderController.java`:
   ```java
   @RestController
   @RequestMapping("/v1/order")
   @RequiredArgsConstructor
   public class OrderController {
       private final ProxyService proxyService;
       
       @GetMapping("/carts")
       public ResponseEntity<?> getCarts(...) {
           return proxyService.forward("order", HttpMethod.GET, "/carts", ...);
       }
   }
   ```

3. **Add permissions** (Phase 6) for `proxy:order:read` and `proxy:order:write`

That's it. ProxyService handles authorization and audit logging automatically.

---

## Performance & Scalability

See [PRD.md](./PRD.md) for performance and scalability requirements.

---

## Deployment Architecture

The application is deployed using Docker containers with Nginx as the reverse proxy for production and Vite dev server proxy for development.
