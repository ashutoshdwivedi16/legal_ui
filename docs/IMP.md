# Implementation Plan (IMP)
## Universal Admin Framework

**Version:** 1.0  
**Date:** 2025-01-13  
**Status:** Ready for Implementation

---

## Overview

This document provides an executable, trackable implementation plan for the Universal Admin Framework. Each phase contains specific tasks with clear acceptance criteria and dependencies.

**Reference Documents:**
- [PRD.md](./PRD.md) - Product Requirements
- [TRD.md](./TRD.md) - Technical Specifications

---

## Existing Project Boilerplate

This project has an established boilerplate. The following components already exist and should NOT be recreated. Tasks that overlap with existing boilerplate are marked as `[x] Completed` in the implementation phases.

### Backend (Spring Boot 3.3.x, Java 21)

**Existing Dependencies** (`build.gradle`):
- Spring Boot Starter: Web, Validation, Actuator, AOP, Data JPA
- PostgreSQL driver, Flyway
- Spring Cloud OpenFeign
- Lombok, SpringDoc OpenAPI
- LG Common Libraries: correlation, exception, flyway, openapi, redis, requestmethod

**Existing Configuration** (`application.yml`):
- Multi-profile setup: LOCAL, DEV, QA, STG, PRD
- PostgreSQL datasource configuration
- Flyway configuration (currently disabled, path: `classpath:flyway/common`)
- Redis configuration
- Context path: `/us/common/admin`

**Existing Package Structure** (Layered):
```
com.lg.microservice.admin/
├── common/                            # Pure infrastructure (no business logic)
│   ├── config/                       # RestTemplateConfig
│   ├── exception/                    # RestCustomException, RestExceptionHandler, ErrorCode
│   ├── response/                     # DataResponse, PageResponse, ErrorResponse
│   ├── security/                     # SecurityConfig, MethodSecurityConfig, CustomPermissionEvaluator
│   └── validator/
├── utils/                             # Static utility helpers
├── core/                              # Framework module (auth, user, rbac)
│   ├── controller/                   # AuthController
│   ├── service/                      # AuthService, AuthStateStore, UserSyncService
│   ├── repository/                   # UserRepository, RoleRepository
│   ├── model/
│   │   ├── dto/                      # TokenResponse, LoginUrlResponse, CallbackRequest, UserInfoResponse
│   │   └── entity/                   # User, Role, Permission
│   └── factory/                      # AuthProvider, AuthProviderFactory, provider/CognitoAuthProvider
└── domain/                            # Business domains (for future modules)
    └── admin/                        # Admin bounded context (future)
```

**Existing Files**:
- `AdminServiceApplication.java` - Main Spring Boot application
- `RestCustomException.java`, `RestExceptionHandler.java`, `RestCustomCode.java`, `ErrorConstants.java`

### Frontend (Vite + React 19 + TypeScript)

**Existing Dependencies** (`package.json`):
- React 19, React DOM, React Router DOM
- TanStack Query, Zustand, Axios
- Tailwind CSS v4, tw-animate-css, clsx, tailwind-merge, lucide-react
- ShadCN UI components (Radix UI primitives)
- Zod, React Hook Form

**Existing Configuration**:
- `vite.config.ts` - Path aliases, Tailwind v4 plugin (`@tailwindcss/vite`), proxy with token injection
- `components.json` - ShadCN configuration
- `tsconfig.json` - TypeScript configuration
- `index.css` - Tailwind v4 CSS-first config with `@theme inline` for ShadCN colors

**Tailwind CSS v4 Setup**:
- No `tailwind.config.js` (CSS-first configuration)
- No `postcss.config.js` (Vite plugin handles it)
- Theme defined via `@theme inline` in `index.css`
- Animations via `tw-animate-css` package

**Existing Folder Structure**:
```
src/
├── core/
│   ├── auth/index.ts
│   ├── layout/{MainLayout.tsx, components/Header.tsx, components/Sidebar.tsx}
│   └── common/{Loading.tsx, ErrorBoundary.tsx}
├── shared/
│   ├── components/ui/          # Empty - ShadCN components to be added
│   ├── hooks/
│   ├── lib/{axios.ts, query-client.ts, utils.ts}
│   ├── types/
│   └── utils/
├── modules/
├── pages/{Home.tsx}
├── App.tsx
└── main.tsx
```

**Existing Files**:
- `App.tsx` - Basic routing with ErrorBoundary, QueryClientProvider
- `MainLayout.tsx`, `Header.tsx`, `Sidebar.tsx` - Placeholder layout components
- `Loading.tsx`, `ErrorBoundary.tsx` - Working utility components
- `query-client.ts` - TanStack Query client configured
- `axios.ts` - Axios instance (commented out, needs implementation)
- `utils.ts` - `cn()` utility for Tailwind class merging
- `index.css` - Tailwind v4 with ShadCN CSS variables and `@theme inline`
- `use-toast.ts` - ShadCN toast hook

### Infrastructure

**Docker Compose** (`docker-compose.yml`):
- PostgreSQL 16 container with health checks
- Redis 7 container with persistence
- Backend container with Gradle cache volume
- Frontend container (pnpm, anonymous volume for node_modules)
- Shared network for inter-container communication

**Dockerfiles**:
- `backend/Dockerfile`, `backend/Dockerfile.dev`
- `frontend/Dockerfile`, `frontend/Dockerfile.dev` (uses pnpm via corepack)

**Environment**:
- `.env` file with all required environment variables

---

## Development Workflow

### IMPORTANT: Docker-First Development

**All development and implementation tasks MUST be performed through Docker containers.** Do not install dependencies or run commands directly on the host machine.

### Starting Development Environment

```bash
# Start all services
docker-compose up

# Start only infrastructure (for IDE-based development with hot reload)
docker-compose up database redis

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Running Commands in Containers

```bash
# Backend commands (Gradle)
docker-compose exec backend ./gradlew build
docker-compose exec backend ./gradlew test
docker-compose exec backend ./gradlew bootRun

# Frontend commands (pnpm)
docker-compose exec frontend pnpm add <package>
docker-compose exec frontend pnpm run build
docker-compose exec frontend pnpm run lint
docker-compose exec frontend pnpm dlx shadcn@latest add <component>
```

### Adding Dependencies

```bash
# Backend - Edit build.gradle, then:
docker-compose exec backend ./gradlew build --refresh-dependencies

# Frontend - Use pnpm in container:
docker-compose exec frontend pnpm add <package-name>
docker-compose exec frontend pnpm add -D <dev-package-name>

# After adding deps, rebuild container to update lock file:
docker-compose build frontend
```

### Database Migrations

```bash
# Flyway migrations run automatically on backend startup
# To manually run migrations:
docker-compose exec backend ./gradlew flywayMigrate

# To check migration status:
docker-compose exec backend ./gradlew flywayInfo
```

### Testing

```bash
# Backend tests
docker-compose exec backend ./gradlew test

# Frontend build verification
docker-compose exec frontend pnpm run build

# Lint checks
docker-compose exec frontend pnpm run lint
```

### Accessing Services

| Service | URL | Notes |
|---------|-----|-------|
| Frontend | http://localhost:${FRONTEND_PORT} | Default: 3000 |
| Backend API | http://localhost:${BACKEND_PORT}/us/common/admin | Default: 8080 |
| Swagger UI | http://localhost:${BACKEND_PORT}/us/common/admin/swagger-ui/index.html | |
| PostgreSQL | localhost:${POSTGRES_PORT} | Default: 5432 |
| Redis | localhost:${REDIS_PORT} | Default: 6379 |

### Phase Verification Checklist

After completing each phase:
1. [ ] Run `docker-compose up` - all services start without errors
2. [ ] Backend health check: `curl http://localhost:8080/us/common/admin/actuator/health`
3. [ ] Run backend tests: `docker-compose exec backend ./gradlew test`
4. [ ] Run frontend build: `docker-compose exec frontend pnpm run build`
5. [ ] Manually verify acceptance criteria through browser/API calls
6. [ ] Document any issues found

---

## Implementation Phases

| Phase | Name | Duration | Dependencies |
|-------|------|----------|--------------|
| 0 | Project Setup | 1-2 days | None |
| 1 | Backend Foundation | 3-4 days | Phase 0 |
| 2 | Authentication | 3-4 days | Phase 1 |
| 3 | Frontend Foundation | 3-4 days | Phase 0 |
| 4 | Service Proxy Layer | 2-3 days | Phase 1 |
| 5 | User Management | 3-4 days | Phase 2, 3 |
| 6 | RBAC & ACL | 4-5 days | Phase 5 |
| 7 | User Profile | 1-2 days | Phase 5 |
| 8 | Audit Logging | 2-3 days | Phase 6 |
| 9 | Integration & Testing | 2-3 days | Phase 8 |
| 10 | CRUDL Scaffolding CLI | 3-4 days | Phase 9 |

**Total Estimated Duration:** 27-40 days

---

## Phase 0: Project Setup

### Objective
Set up project structure, development environment, and base configurations.

### Tasks

#### 0.1 Backend Project Setup
- [x] **0.1.1** Create Spring Boot project with required dependencies *(EXISTS)*
  - Spring Boot 3.3.x, Java 21
  - Spring Data JPA, PostgreSQL driver, Redis
  - Flyway for migrations
  - LG common libraries
  - **TODO**: Add Spring Security, OAuth2 Resource Server, Cognito SDK
- [x] **0.1.2** Configure `application.yml` with profiles (LOCAL, DEV, QA, STG, PRD) *(EXISTS)*
  - **TODO**: Add auth provider configuration section
- [x] **0.1.3** Set up Docker Compose for local development *(EXISTS)*
  - PostgreSQL container with health checks
  - Redis container with persistence
  - Backend and frontend containers with volume mounts
- [x] **0.1.4** Create base package structure (DDD) *(EXISTS)*
  ```
  com.lg.microservice.admin/
  ├── shared/
  │   ├── domain/
  │   └── infrastructure/
  └── domain/
      ├── auth/
      └── admin/
  ```
- [x] **0.1.5** Configure Flyway migrations path *(DONE)*
  - Enabled Flyway in application.yml
  - Changed migration path to `classpath:db/migration`
  - `backend/src/main/resources/db/migration/` folder exists

**Acceptance Criteria:**
- `docker-compose up` starts all services without errors
- Backend connects to PostgreSQL and Redis
- All profiles configured

#### 0.2 Frontend Project Setup
- [x] **0.2.1** Create Vite + React 19 + TypeScript project *(EXISTS)*
- [x] **0.2.2** Install and configure dependencies *(DONE)*
  - [x] Tailwind CSS
  - [x] ShadCN UI (initialized, components.json exists)
  - [x] Zustand
  - [x] TanStack Query
  - [x] React Router DOM
  - [x] Axios
  - [x] Zod (validation)
  - [x] React Hook Form + @hookform/resolvers
  - [x] Removed AWS Amplify packages
  - [x] Removed `packageManager` field from package.json
- [x] **0.2.3** Configure path aliases (`@shared`, `@core`, `@modules`) *(EXISTS)*
- [x] **0.2.4** Set up Vite proxy configuration for `/api` → backend *(DONE)*
  - Proxy config added to vite.config.ts
  - Target: `http://backend:8080/us/common/admin` (Docker network)
- [x] **0.2.5** Create base folder structure *(EXISTS)*
  ```
  src/
  ├── core/
  │   ├── auth/
  │   └── layout/
  ├── shared/
  │   ├── components/ui/
  │   └── lib/
  └── modules/
      ├── admin/
      └── profile/
  ```
- [x] **0.2.6** Add base ShadCN UI components *(DONE)*
  - Installed: button, input, label, card, form, select, dropdown-menu, table, dialog, alert-dialog, badge, separator, skeleton, avatar, checkbox, toast, sonner
- [x] **0.2.7** Configure Vite proxy token injection *(DONE)*
  - Token Handler Pattern implemented: extracts `access_token` cookie → injects `Authorization: Bearer` header

**Acceptance Criteria:**
- [x] `docker-compose up frontend` starts successfully
- [x] Proxy routes to backend (when backend is running)
- [x] Proxy injects Bearer token from cookie
- [x] `docker-compose exec frontend pnpm run build` succeeds

---

## Phase 1: Backend Foundation

### Objective
Set up shared infrastructure, database schema, and base configurations.

### Tasks

#### 1.1 Database Schema ✅ COMPLETE
- [x] **1.1.1** Create Flyway migration: `V1__create_users_table.sql`
- [x] **1.1.2** Create Flyway migration: `V2__create_roles_table.sql`
- [x] **1.1.3** Create Flyway migration: `V3__create_permissions_table.sql`
- [x] **1.1.4** Create Flyway migration: `V4__create_user_roles_table.sql`
- [x] **1.1.5** Create Flyway migration: `V5__create_role_permissions_table.sql`
- [x] **1.1.6** Create Flyway migration: `V6__create_audit_logs_table.sql`
- [x] **1.1.7** Create Flyway migration: `V7__create_triggers_and_seed_data.sql`

**Acceptance Criteria:** ✅
- All 7 migrations run successfully via Spring Boot Flyway autoconfiguration
- Tables created: users, roles, permissions, user_roles, role_permissions, audit_logs
- Default roles seeded: ADMIN (15 permissions), USER (4 read permissions)
- 15 admin module permissions seeded

#### 1.2 Shared Domain Layer ✅ COMPLETE
- [x] **1.2.1** Create base domain classes in `shared/domain/`
  - `AggregateRoot.java` - Base class for aggregate roots with domain event support
  - `Entity.java` - Base entity with identity-based equality
  - `ValueObject.java` - Base value object with structural equality
  - `DomainEvent.java` - Base class for domain events
- [x] **1.2.2** Create exception classes
  - [x] `RestCustomException.java` *(EXISTS)*
  - [x] `ErrorCode.java` enum - Comprehensive error codes for all modules
  - [x] `RestExceptionHandler.java` *(EXISTS)*
- [x] **1.2.3** Create response wrapper classes in `shared/infrastructure/response/`
  - `DataResponse.java` - Generic data wrapper with success/message
  - `PageResponse.java` - Paginated response with page metadata
  - `ErrorResponse.java` - Error response with field errors and timestamp

**Acceptance Criteria:** ✅
- Backend compiles successfully: `docker-compose exec backend ./gradlew compileJava`

#### 1.3 Shared Infrastructure ✅ COMPLETE
- [x] **1.3.1** Redis caching - Provided by LG `common.lib.redis` library
  - Already configured in `application.yml` under `spring.data.redis`
- [x] **1.3.2** Correlation ID filter - Provided by LG `common.lib.correlation` library
  - Autoconfigured by the common library
- [x] **1.3.3** Create `RestTemplateConfig.java`
  - Located at `common/config/RestTemplateConfig.java`
  - Configured with timeouts, correlation ID propagation, and authorization header forwarding

**Acceptance Criteria:** ✅
- Backend compiles successfully
- RestTemplate configured for service proxy pattern

---

## Phase 2: Authentication

### Objective
Implement Cognito-based authentication with Token Handler Pattern.

### Tasks

#### 2.1 Auth Provider Infrastructure ✅ COMPLETE
- [x] **2.1.1** Create `AuthProvider` interface
  - Located at `core/factory/AuthProvider.java`
  - Generic interface with methods: `getLoginUrl()`, `getLogoutUrl()`, `exchangeCodeForTokens()`, `refreshAccessToken()`, `revokeToken()`, `createJwtDecoder()`, `createJwtAuthenticationConverter()`
- [x] **2.1.2** Create `AuthProviderFactory`
  - Located at `core/factory/AuthProviderFactory.java`
- [x] **2.1.3** Create `AuthProviderProperties` configuration class
  - Located at `core/factory/AuthProviderProperties.java`
- [x] **2.1.4** Create `CognitoAuthProvider` implementation
  - Located at `core/factory/provider/CognitoAuthProvider.java`
  - Consolidates all Cognito-specific logic (token exchange, refresh, revoke)
- [x] **2.1.5** Create `CognitoJwtAuthenticationConverter`
  - Located at `core/factory/provider/CognitoJwtAuthenticationConverter.java`

**Acceptance Criteria:** ✅
- Auth provider selected based on configuration
- JWT decoder configured correctly

#### 2.2 Security Configuration ✅ COMPLETE
- [x] **2.2.1** Create `SecurityConfig.java`
  - Located at `common/security/SecurityConfig.java`
  - CSRF disabled (Token Handler Pattern)
  - OAuth2 Resource Server with JWT
  - Stateless session management
  - Public endpoints: `/api/v1/auth/**`
  - Protected endpoints: `/api/v1/admin/**`
- [x] **2.2.2** Create `MethodSecurityConfig.java`
  - Located at `common/security/MethodSecurityConfig.java`
  - Enable `@PreAuthorize`
  - Configure `CustomPermissionEvaluator`
- [x] **2.2.3** Create `CustomPermissionEvaluator.java`
  - Located at `common/security/CustomPermissionEvaluator.java`
  - Wildcard permission matching

**Acceptance Criteria:** ✅
- Protected endpoints require valid JWT
- `@PreAuthorize` annotations work

#### 2.3 Auth Endpoints ✅ COMPLETE
- [x] **2.3.1** Create `AuthController.java`
  - Located at `core/controller/AuthController.java`
  - Generic controller that delegates to AuthService
  - `GET /api/v1/auth/login` - Redirect to Cognito Hosted UI
  - `GET /api/v1/auth/callback` - Handle OAuth callback, set cookies
  - `GET /api/v1/auth/me` - Get current user info
  - `POST /api/v1/auth/refresh` - Refresh access token
  - `POST /api/v1/auth/logout` - Clear cookies, revoke token
  - `GET /api/v1/auth/change-password` - Redirect to Cognito password change
- [x] **2.3.2** Create `AuthStateStore` for PKCE state management
  - Located at `core/service/AuthStateStore.java`
- [x] **2.3.3** Create `AuthService` as orchestrator
  - Located at `core/service/AuthService.java`
  - Orchestrates auth flow using AuthProvider

**Acceptance Criteria:** ✅
- Login redirects to Cognito
- Callback exchanges code, sets HttpOnly cookies
- `/api/v1/auth/me` returns user info from JWT
- Logout clears cookies

#### 2.4 User Sync Service ✅ COMPLETE
- [x] **2.4.1** Create `UserSyncService.java`
  - Located at `core/service/UserSyncService.java`
  - `syncUserFromIdToken()` - Create/update user from ID token claims (primary method)
  - `syncUserFromJwt()` - Fallback for access token (limited claims)
  - Race condition handling via `DataIntegrityViolationException` catch
- [x] **2.4.2** Track login count and last login time
- [x] **2.4.3** ID Token extraction during OAuth callback
  - `AuthController.handleCallback()` decodes ID token using Nimbus JWT
  - Extracts `sub`, `email`, `given_name`, `family_name` claims
  - Syncs user immediately during callback (not deferred to `/auth/me`)

**IMPORTANT Implementation Note**: Cognito Access Tokens do NOT contain user profile claims (email, given_name, family_name). These are only in the ID Token. The implementation decodes the ID token during the OAuth callback to extract full user profile.

**Acceptance Criteria:** ✅
- First login creates user in database with correct email, firstName, lastName
- Subsequent logins update user info if changed
- Activity tracking works
- Race condition on concurrent user creation is handled gracefully

---

## Phase 3: Frontend Foundation

### Objective
Set up frontend auth flow, routing, and layout components.

### Tasks

#### 3.1 Axios Configuration ✅ COMPLETE
- [x] **3.1.1** Create `src/shared/lib/axios.ts`
  - Base URL: `/api`
  - `withCredentials: true`
  - Response interceptor for 401 → refresh token with queue pattern
- [~] **3.1.2** Test proxy configuration with backend
  - Verify: `docker-compose up` then check network calls in browser

**Acceptance Criteria:**
- API calls include cookies ✅
- 401 triggers token refresh ✅

#### 3.2 Auth Store ✅ COMPLETE
- [x] **3.2.1** Create `src/core/auth/stores/authStore.ts`
  - `isAuthenticated`, `user`, `isLoading`, `error`
  - `checkAuth()` - Call `/api/v1/auth/me`
  - `logout()` - Call `/api/v1/auth/logout`
- [x] **3.2.2** Create `login` helper functions (`src/core/auth/login.ts`)
  - `login.redirect(returnTo)` - Redirect to `/api/v1/auth/login`
  - `login.popup(returnTo)` - Popup login

**Acceptance Criteria:** ✅
- Auth state managed correctly
- Login redirects work

#### 3.3 Permission Store ✅ COMPLETE
- [x] **3.3.1** Create `src/core/auth/stores/permissionStore.ts`
  - `roles`, `permissions`
  - `hasRole()`, `hasPermission()`
  - `hasAnyRole()`, `hasAnyPermission()`
  - `hasAllRoles()`, `hasAllPermissions()`
  - Wildcard permission matching

**Acceptance Criteria:** ✅
- Permission checks work
- Wildcard permissions (e.g., `users:*`) work

#### 3.4 Auth Components ✅ COMPLETE
- [x] **3.4.1** Create `ProtectedRoute.tsx`
  - Check auth, roles, permissions
  - Redirect to login if not authenticated
  - Redirect to unauthorized if no permission
- [x] **3.4.2** Create `RequirePermission.tsx` - Content-level guard
- [x] **3.4.3** Create `RequireRole.tsx` - Content-level guard
- [x] **3.4.4** Create `LoginPage.tsx` - Simple page with login button
- [x] **3.4.5** Create `UnauthorizedPage.tsx` - 403 forbidden page
- [x] **3.4.6** Create `AuthProvider.tsx` - Wraps app, calls checkAuth on mount

**Acceptance Criteria:** ✅
- Protected routes redirect to login
- Content guards hide/show elements

#### 3.5 Layout Components ✅ COMPLETE
- [x] **3.5.1** Create `MainLayout.tsx` - Main layout with Header and Sidebar
- [x] **3.5.2** Create `Sidebar.tsx` - Navigation sidebar with permission-based menu
- [x] **3.5.3** Create `Header.tsx` - Top header with ProfileDropdown
- [x] **3.5.4** Create `ProfileDropdown.tsx` - User menu dropdown with logout
- [x] **3.5.5** Create `Loading.tsx` - Loading spinner component *(EXISTS)*
- [x] **3.5.6** ShadCN Toast (sonner) added to App layout
- [x] **3.5.7** Create `ErrorBoundary.tsx` - Error boundary with fallback UI *(EXISTS)*
- [x] **3.5.8** Create `Skeletons.tsx` loading components (SkeletonList, SkeletonCard, SkeletonTable, SkeletonForm)
- [x] **3.5.9** Create `EmptyState.tsx` - Empty state component with variants (default, search, error)
- [x] **3.5.10** Make Sidebar responsive (MobileSidebar with Sheet for mobile hamburger menu)
- [x] **3.5.11** Create `Breadcrumb.tsx` - Auto-generated breadcrumb navigation from route

**Acceptance Criteria:** ✅
- Layout renders correctly
- Navigation works
- Profile dropdown shows user info
- Toast notifications work
- Error boundary catches and displays errors gracefully
- Loading skeletons display during data fetch
- Empty states shown when no data
- Sidebar collapses on mobile (hamburger menu)
- Breadcrumbs show navigation path

#### 3.6 Routing ✅ COMPLETE
- [x] **3.6.1** Set up React Router with routes and protected routes
  - `/login` - Public (LoginPage)
  - `/unauthorized` - Public (UnauthorizedPage)
  - `/` - Dashboard (protected)
  - `/profile` - User profile (protected)
  - `/admin/users` - User management (protected, requires `users:read`)
  - `/admin/roles` - Role management (protected, requires `roles:read`)
  - `/admin/permissions` - Permission management (protected, requires `permissions:read`)
- `/audit-logs` - Audit logs (protected, requires `admin.audit-logs:read`)
- [x] **3.6.2** Update `auth/index.ts` with all module exports

**Acceptance Criteria:** ✅
- All routes work
- Protected routes check auth
- Permission-based routes check permissions

#### 3.7 Theme Infrastructure
- [x] **3.7.1** Create `ThemeProvider.tsx` with CSS variables for design tokens *(EXISTS in index.css)*
- [x] **3.7.2** Define CSS variables for colors, spacing, typography, borders, shadows *(EXISTS in index.css + tailwind.config.js)*

**Acceptance Criteria:**
- ThemeProvider wraps application
- CSS variables available throughout the app
- ShadCN components use CSS variables for styling

---

## Phase 4: Service Proxy Layer ✅ COMPLETE

### Objective
Establish the **layered architecture convention** for all backend code and implement external microservice integrations with a sample mock service as reference.

**Core Convention**: Controller → Service (interface) → ServiceImpl (ALL logic here)

Controllers are THIN - they only handle HTTP concerns. ALL business logic lives in Service layer. What ServiceImpl calls depends on the use case (FeignClient for external services, Repository for database, other Services for orchestration).

**Note**: This phase implements basic proxy functionality only. Authorization checks will be added in Phase 6 (RBAC & ACL via `@PreAuthorize` on Service), and audit logging will be added in Phase 8 (via `@Auditable` AOP on Service).

### Tasks

#### 4.1 Backend Layered Architecture Convention ✅ COMPLETE
- [x] **4.1.1** Establish mandatory layered pattern:
  ```
  Controller → Service (interface) → ServiceImpl (@Service, ALL LOGIC HERE)
  ```
- [x] **4.1.2** Controllers are THIN - no business logic, only HTTP concerns
- [x] **4.1.3** ALL business logic lives in ServiceImpl
- [x] **4.1.4** Services ALWAYS have interface + impl separation

#### 4.2 Backend Feign Configuration ✅ COMPLETE
- [x] **4.2.1** Configure Feign in `application.yml`
  - `microservice.host` - Base host for external services (environment-specific)
  - `microservice.sample` - Sample service URL (points to mock in LOCAL)
  - `microservice.communication` - Communication service URL
  - Per-profile host overrides (LOCAL_CFG, DEV_CFG, QA_CFG, STG_CFG, PRD_CFG)
- [x] **4.2.2** Spring Cloud OpenFeign auto-configuration
  - Feign client library already in `build.gradle`
  - `@EnableFeignClients` on application or config class

#### 4.3 Sample Service - Full Implementation ✅ COMPLETE
- [x] **4.3.1** Create `SampleFeignClient.java`
  - `@FeignClient(name = "sample", url = "${microservice.sample}")`
  - Methods matching mock controller endpoints (including query, status, sort params and bulk delete)
- [x] **4.3.2** Create `SampleService.java` interface
  - `getItems(page, size, query, status, sort)` - List with pagination, filtering, sorting
  - `getItem(id)` - Get single item
  - `createItem(request)` - Create item
  - `updateItem(id, request)` - Update item
  - `deleteItem(id)` - Delete item
  - `deleteItems(ids)` - Bulk delete items
- [x] **4.3.3** Create `SampleServiceImpl.java`
  - `@Service` implementation with ALL business logic
  - Injects `SampleFeignClient`
  - Delegates HTTP calls to Feign client
- [x] **4.3.4** Create `SampleController.java` at `/v1/sample/**`
  - THIN controller - only HTTP mapping
  - Injects `SampleService` interface (not FeignClient directly)
  - `GET /v1/sample/items` - List with pagination, sorting, filtering (query, status, sort params)
  - `GET /v1/sample/items/{id}` - Get single item
  - `POST /v1/sample/items` - Create item
  - `PUT /v1/sample/items/{id}` - Update item
  - `DELETE /v1/sample/items/{id}` - Delete item
  - `DELETE /v1/sample/items` - Bulk delete items by IDs

#### 4.4 Sample Mock Backend ✅ COMPLETE
- [x] **4.4.1** Create `SampleMockController.java` at `/mock/sample/**`
  - Internal endpoint simulating external microservice
  - `GET /mock/sample/items` - Return paginated items from in-memory store (with query, status, sort params)
  - `GET /mock/sample/items/{id}` - Return single item or 404
  - `POST /mock/sample/items` - Create item, return 201
  - `PUT /mock/sample/items/{id}` - Update item or 404
  - `DELETE /mock/sample/items/{id}` - Delete item, return 204
  - `DELETE /mock/sample/items` - Bulk delete items by IDs, return 204
- [x] **4.4.2** Create `SampleItemDto.java`
  - Fields: `id`, `name`, `description`, `status`, `createdAt`, `updatedAt`
- [x] **4.4.3** Create `SampleItemStatus.java` enum
  - Values: `ACTIVE`, `INACTIVE`, `PENDING`, `ARCHIVED`
- [x] **4.4.4** Create request DTOs with validation
  - `CreateSampleItemRequest.java`, `UpdateSampleItemRequest.java`, `BulkDeleteRequest.java`
- [x] **4.4.5** Create `SampleMockDataStore.java`
  - In-memory `ConcurrentHashMap` storage
  - Pre-populated with 15 sample items
  - Thread-safe CRUD operations
  - Server-side sorting with field comparators (id, name, status, createdAt, updatedAt)
  - Server-side filtering (status enum filter, text search across name/description)
  - Bulk delete support
- [x] **4.4.6** Add OpenAPI annotations
  - `@Tag`, `@Operation`, `@ApiResponse` for Swagger documentation

#### 4.5 Communication Service Integration ✅ COMPLETE
- [x] **4.5.1** Create `CommunicationFeignClient.java`
  - `@FeignClient(name = "communication", url = "${microservice.communication}")`
  - 20 methods for templates, flows, transactions, reports
- [x] **4.5.2** Create `CommunicationService.java` interface
  - Full API surface for communication service
- [x] **4.5.3** Create `CommunicationServiceImpl.java`
  - `@Service` implementation with ALL business logic
  - Delegates HTTP calls to Feign client
- [x] **4.5.4** Update `CommunicationController.java`
  - Changed from direct FeignClient injection to Service injection
  - THIN controller - only HTTP mapping
  - 15 endpoints registered in Swagger

#### 4.6 Security Configuration ✅ COMPLETE
- [x] **4.6.1** Update `SecurityConfig.java` to default-deny approach
  - Explicit permitAll: `/actuator/**`, `/v1/auth/**`, `/openapi/**`, `/mock/**`
  - `anyRequest().authenticated()` - new services automatically protected
  - Removed need to manually add each service endpoint

#### 4.7 Documentation ✅ COMPLETE
- [x] **4.7.1** Update `backend/AGENTS.md`
  - Layered architecture convention (Controller → Service → ServiceImpl)
  - Controllers are THIN - no logic
  - ALL logic in ServiceImpl
  - Step-by-step guide for adding new service integrations
- [x] **4.7.2** Update `docs/TRD.md` Service Proxy Pattern section
  - Replaced WebClient architecture with Feign-based pattern
  - Updated diagrams and code examples
  - Updated URL flow documentation

**Acceptance Criteria:** ✅
- [x] Layered architecture established: Controller (thin) → Service (interface) → ServiceImpl (all logic)
- [x] Sample service proxy flow works: `/v1/sample/items` → Service → Feign → `/mock/sample/items`
- [x] Communication service refactored to same pattern
- [x] Headers propagated via Feign configuration
- [x] Sample mock service returns realistic paginated data
- [x] CRUD operations work: GET (list/detail), POST, PUT, DELETE
- [x] Backend compiles: `docker-compose exec -T backend ./gradlew compileJava --no-daemon`
- [x] Swagger UI shows `/v1/sample/**`, `/v1/communication/**`, and `/mock/sample/**` endpoints
- [x] Security uses default-deny approach (new services auto-protected)

---

## Phase 5: User Management ✅ COMPLETE

### Objective
Implement user CRUD operations with Cognito integration.

### Tasks

#### 5.1 Backend - User Domain ✅ COMPLETE
- [x] **5.1.1** Create `User.java` entity
  - Located at `core/model/entity/User.java`
  - JPA entity implementing UserDetails with roles, timestamps, login tracking
- [x] **5.1.2** Create `UserRepository.java` interface
  - Located at `core/repository/UserRepository.java`
  - Full query methods: findByExternalUserId, findByEmail, searchUsers, pagination
- [x] **5.1.3** Create DTOs
  - `UserDto.java` - Full user data with roles
  - `CreateUserRequest.java` - With validation for email, temp password
  - `UpdateUserRequest.java` - For partial updates
  - `UserListParams.java` - Defined in frontend (`users.api.ts`)
  - `UserInfoResponse.java` - Current user info with roles/permissions

**Acceptance Criteria:** ✅
- Entity maps to database correctly
- Repository methods work

#### 5.2 Backend - Cognito User Service ✅ COMPLETE
- [x] **5.2.1** Create `CognitoUserManagementProvider.java`
  - Located at `core/factory/provider/CognitoUserManagementProvider.java`
  - `createUser(email, temporaryPassword, firstName, lastName)` - AdminCreateUser
  - `deleteUser(cognitoUserId)` - AdminDeleteUser
  - `enableUser(cognitoUserId)` / `disableUser(cognitoUserId)` - Enable/disable user

**Acceptance Criteria:** ✅
- Users created in Cognito with FORCE_CHANGE_PASSWORD status
- User deletion works

#### 5.3 Backend - User Service & Controller ✅ COMPLETE
- [x] **5.3.1** Create `UserService.java`
  - Located at `core/service/UserService.java` (interface) + `core/service/impl/UserServiceImpl.java`
  - `getCurrentUser(jwt)` - Get current user from JWT
  - `getUser(id)` - Get user by ID
  - `getUsers(query, status, pageable)` - List with filtering and pagination
  - `createUser(request)` - Create in Cognito + local DB
  - `updateUser(id, request)` - Update user
  - `deleteUser(id)` - Delete from Cognito + local DB
  - `assignRoles(userId, roleIds)` - Assign roles to user
- [x] **5.3.2** Create `UserController.java`
  - Located at `core/controller/UserController.java`
  - `GET /v1/admin/users` - List users with pagination/filtering
  - `GET /v1/admin/users/{id}` - Get single user
  - `POST /v1/admin/users` - Create user
  - `PUT /v1/admin/users/{id}` - Update user
  - `DELETE /v1/admin/users/{id}` - Soft delete user
  - `PUT /v1/admin/users/{id}/roles` - Assign roles
  - All endpoints protected with `@PreAuthorize` permissions

**Acceptance Criteria:** ✅
- All CRUD operations work
- Cognito integration works
- Permission checks enforced

#### 5.4 Frontend - User Module ✅ COMPLETE
- [x] **5.4.1** Create user types (`users.api.ts`)
  - User, RoleDto, CreateUserRequest, UpdateUserRequest, AssignRolesRequest types
- [x] **5.4.2** Create user API and hooks (`users.api.ts`)
  - `getUsers()` - List users with TanStack Query
  - `getUser(id)` - Get single user
  - `createUser()` - Create mutation
  - `updateUser()` - Update mutation
  - `deleteUser()` - Delete mutation
  - `assignRoles()` - Assign roles mutation
- [x] **5.4.3** Create `UsersPage.tsx` (serves as list page)
  - TanStack Table integration with full features
- [x] **5.4.4** Create `UserList.tsx` component (data table)
  - Integrated in UsersPage.tsx with TanStack Table
- [x] **5.4.5** Create `UserForm.tsx` component
  - Handles create and edit functionality
- [x] **5.4.6** Create `UserCreatePage.tsx`
  - Via routes + UserForm component
- [x] **5.4.7** Create `UserEditPage.tsx`
  - Via routes + UserForm component
- [x] **5.4.8** Create `UserDetailPage.tsx`
  - Edit form serves as detail view (shows all user data)
- [x] **5.4.9** Create `UserDeleteDialog.tsx`
  - Integrated in UsersPage.tsx with AlertDialog
- [x] **5.4.10** Add column visibility toggle to data tables
  - Dropdown menu with checkbox items for each column
  - Persisted to localStorage per page
  - Reset to default functionality
- [x] **5.4.11** Add row selection for bulk operations
  - Checkbox column with "Select All" functionality
  - Bulk delete with AlertDialog confirmation
  - Selection count in footer

**Acceptance Criteria:** ✅
- List users with pagination, sorting, filtering
- Column visibility can be toggled and persists across sessions
- Rows can be selected for bulk actions (bulk delete with confirmation)
- Create user form works
- Edit user form works
- Delete user with confirmation
- Role assignment works
- Sample items list page has full CRUDL features (search, filter, sort, column visibility, bulk delete, row actions)

---

## Phase 6: RBAC (Roles & Permissions) ✅ COMPLETE

### Objective
Implement role-based access control with full Roles CRUDL, read-only Permissions page, and ADMIN auto-grant logic.

### Scope Changes (vs Original Plan)
- **Deferred**: ACL (Access Control Lists) — moved to future phase
- **Deferred**: Proxy Authorization — moved to future phase  
- **Simplified**: Permission management is read-only (auto-synced from code annotations)
- **Added**: `isAdmin` flag for automatic all-permissions grant
- **Changed**: API paths from `/v1/admin/*` to `/v1/*`

### Tasks

#### 6.1 Backend - Security & Schema ✅ COMPLETE
- [x] **6.1.1** Fix `SecurityConfig.java` — `anyRequest().authenticated()` with public allowlist
  - Public endpoints: `/actuator/**`, `/v1/auth/**`, `/v1/permissions/sync`, `/openapi/**`, `/swagger-ui/**`, `/mock/**`, `/flyway/**`
- [x] **6.1.2** Flyway V9 — Drop `description` column from permissions, add `permission_string` column mapping
- [x] **6.1.3** Remove `CustomPermissionEvaluator.java`, simplify `MethodSecurityConfig.java`
- [x] **6.1.4** Flyway V10 — Add `is_admin BOOLEAN` column to roles, update ADMIN role
- [x] **6.1.5** Update `Role.java` entity with `isAdmin` field

#### 6.2 Backend - ADMIN Auto-Grant Logic ✅ COMPLETE
- [x] **6.2.1** Update `CognitoJwtAuthenticationConverter` — ADMIN role auto-grants ALL permissions
  - If user has ANY role with `isAdmin=true`, fetch ALL permissions from DB
  - Non-admin users use normal role_permissions join table
- [x] **6.2.2** Inject `PermissionRepository` into auth converter via `CognitoAuthProvider`

#### 6.3 Backend - Role Service & Controller ✅ COMPLETE
- [x] **6.3.1** Create `RoleService.java` interface + `RoleServiceImpl.java`
  - `getRoles(pageable, name)` — Paginated list with optional name filter
  - `getRole(id)` — Get single role WITH permissions (EntityGraph)
  - `getActiveRoles()` — Simple list for dropdowns
  - `createRole(request)` — Create with permission assignment
  - `updateRole(id, request)` — Update with permission replacement
  - `deleteRole(id)` — Block deletion of `isAdmin=true` roles
- [x] **6.3.2** Create DTOs: `CreateRoleRequest`, `UpdateRoleRequest`, `RoleDetailDto`, `PermissionDto`
- [x] **6.3.3** Create `RoleController.java` at `/v1/roles`
  - `GET /v1/roles` — Paginated list
  - `GET /v1/roles/{id}` — Detail with permissions
  - `GET /v1/roles/active` — Active roles for dropdowns
  - `POST /v1/roles` — Create role
  - `PUT /v1/roles/{id}` — Update role
  - `DELETE /v1/roles/{id}` — Delete role

#### 6.4 Backend - Permission Service & Controller ✅ COMPLETE
- [x] **6.4.1** Create `PermissionRepository.java` with query methods
- [x] **6.4.2** Create `PermissionService.java` interface + `PermissionServiceImpl.java`
  - `getPermissionTree()` — Permissions grouped by resource
  - `getAllPermissions()` — Flat list
  - `syncPermissions()` — Scan `@PreAuthorize` annotations, reconcile with DB
- [x] **6.4.3** Create DTOs: `PermissionTreeDto`, `PermissionSyncResultDto`
- [x] **6.4.4** Create `PermissionController.java` at `/v1/permissions`
  - `GET /v1/permissions` — Tree view (requires auth)
  - `GET /v1/permissions/flat` — Flat list (requires auth)
  - `POST /v1/permissions/sync` — **PUBLIC** (no auth required)

#### 6.5 Backend - API Path Migration ✅ COMPLETE
- [x] **6.5.1** Update `UserController.java` — `/v1/admin/users` → `/v1/users`

#### 6.6 Frontend - API Updates ✅ COMPLETE
- [x] **6.6.1** Update `users.api.ts` — `/admin/users` → `/users`, `/admin/roles` → `/roles`

#### 6.7 Frontend - Roles Module ✅ COMPLETE
- [x] **6.7.1** Create `roles/api/roles.api.ts` — TanStack Query hooks
- [x] **6.7.2** Create `roles/pages/RolesPage.tsx` — Full list with search, filter, pagination, bulk delete
- [x] **6.7.3** Create `roles/pages/RoleForm.tsx` — Create/Edit/View form with permission tree
- [x] **6.7.4** Create `roles/components/PermissionTree.tsx` — Reusable checkbox tree component
- [x] **6.7.5** Update `roles/routes.tsx` and `roles/menu.tsx`

#### 6.8 Frontend - Permissions Module ✅ COMPLETE
- [x] **6.8.1** Create `permissions/api/permissions.api.ts` — Query and sync hooks
- [x] **6.8.2** Update `permissions/pages/PermissionsPage.tsx` — Read-only tree + sync button
- [x] **6.8.3** Update `permissions/routes.tsx` and `permissions/menu.tsx`

#### 6.9 Frontend - UI Standardization ✅ COMPLETE
- [x] **6.9.1** Standardize List Page Layout across all CRUD pages
  - Header row: Title left, action buttons (Bulk Delete, Create) right
  - Table controls row: Search + Filter dropdowns left, Columns dropdown right
  - Data table with sortable headers
  - Footer: Selection count left, Pagination right
  - Applied to: UsersPage, RolesPage, Sample Items
- [x] **6.9.2** Standardize Form Page Layout (Create/Edit/View)
  - Removed ChevronLeft back navigation from title
  - Wrapped forms with Card component (CardHeader + CardContent)
  - Centered with `max-w-2xl mx-auto`
  - Applied to: UserForm, RoleForm
- [x] **6.9.3** Standardize Route Configuration
  - Simplified routes using `RouteConfig[]` pattern
  - Removed nested ProtectedRoute/MainLayout wrappers in route files
  - Applied to: Sample Items, Communication (templates, flows, transactions, reports)
- [x] **6.9.4** Fix Switch component styling
  - ON state: `bg-primary` (dark)
  - OFF state: `bg-gray-400` (medium grey)
  - Thumb: `bg-white` always
- [x] **6.9.5** Fix admin badge visibility in RolesPage
  - Added `text-primary-foreground` to ADMIN badge for contrast on `bg-destructive`
- [x] **6.9.6** Update TRD.md with standardized patterns
  - Documented List Page Layout diagram
  - Documented Form Page Layout pattern

**Acceptance Criteria:** ✅
- Backend compiles: `docker-compose exec backend ./gradlew compileJava` → BUILD SUCCESSFUL
- Frontend builds: `docker-compose exec frontend pnpm run build` → SUCCESS
- SecurityConfig enforces authentication on protected endpoints
- Permission sync endpoint is PUBLIC (no auth required)
- ADMIN role auto-grants ALL permissions from DB
- All APIs use `/v1/` prefix (no `/v1/admin/`)
- Role CRUD works with permission tree assignment
- Permission tree shows grouped view with sync functionality
- All CRUD list pages follow standardized layout pattern
- All CRUD form pages use Card layout centered on page
- All routes use simplified RouteConfig pattern
- Switch component has proper ON/OFF styling
- Badge text is readable on colored backgrounds

#### 6.10 Deferred Items (Future Phases)
- [-] **6.10.1** ACL (Access Control Lists) — Resource-level permissions
- [-] **6.10.2** Ownership checks (`:own` scope)
- [-] **6.10.3** Field-level access control
- [-] **6.10.4** Proxy Authorization — Permission checks for proxy requests

---

## Phase 7: User Profile

### Objective
Implement user self-service profile page.

### Tasks

#### 7.1 Backend - Change Password Endpoint
- [x] **7.1.1** Add `GET /api/v1/auth/change-password` to `AuthController`
  - Returns URL to Cognito Hosted UI forgotPassword endpoint

**Acceptance Criteria:**
- ✅ Returns JSON with changePasswordUrl
- ✅ URL points to Cognito Hosted UI forgotPassword

#### 7.2 Frontend - Profile Module
- [x] **7.2.1** Create `ProfilePage.tsx`
  - Display user info (email, name, avatar)
  - Display assigned roles with badges
  - Change password button → calls API and redirects to Cognito
  - Logout button
- [x] **7.2.2** Update `AppSidebar.tsx` dropdown
  - Profile link
  - Change password link
  - Logout button

**Acceptance Criteria:**
- ✅ Profile page displays user info
- ✅ Roles displayed with badges
- ✅ Change password redirects to Cognito
- ✅ Logout works

---

## Phase 8: Audit Logging

### Objective
Implement automatic audit logging for all admin operations, including proxy call logging.

### Architecture Decision
**Hibernate Interceptor** approach chosen over JPA Entity Listeners because:
- Provides access to previous values (`previousState[]`) for calculating field changes
- Catches bulk operations (bulk delete/update)
- TRD requires logging what changed (before/after values)

### Design Decisions
| Topic | Decision | Notes |
|-------|----------|-------|
| Full-text search | Simple LIKE search | On userEmail, errorMessage fields |
| Real-time streaming | Deferred | Optional per PRD |
| Retention/auto-purge | Deferred | Handle operationally |
| IP address filter | Deferred | Not critical for MVP |
| Archive functionality | Deferred | Implement in future phase |
| Permission required | `admin.audit-logs:read` | New permission |
| Detail view | Separate page | Route: `/audit-logs/:id` |

### Tasks

#### 8.0 Database Migration
- [x] **8.0.1** Create Flyway migration `V5__create_audit_logs_table.sql`
  - Create `audit_logs` table with all columns per TRD schema
  - Add indexes: user_id, timestamp, resource_type+resource_id, correlation_id, service_name
  - Note: Table already exists from V0_1_0_6 migration
- [x] **8.0.2** Add `admin.audit-logs:read` permission to seed data
  - Created `V0_1_0_11__add_audit_logs_permission.sql` - seeds permission and assigns to ADMIN role

**Acceptance Criteria:**
- Migration runs successfully
- Table and indexes created
- Permission seeded

#### 8.1 Backend - Audit Infrastructure
- [x] **8.1.1** Create `AuditLog.java` entity with all fields:
  - id, timestamp, userId, userEmail, action, resourceType, resourceId
  - details (JSONB via `@JdbcTypeCode(SqlTypes.JSON)`), ipAddress, userAgent, success, errorMessage
  - serviceName, endpoint, httpMethod, correlationId (for proxy operations)
- [x] **8.1.2** Create `AuditLogRepository.java` extending `JpaRepository` and `JpaSpecificationExecutor`
- [x] **8.1.3** Add `AUDIT_LOG_NOT_FOUND` to `ErrorCode.java` enum
- [x] **8.1.4** Add audit configuration to `application.yml`:
  ```yaml
  audit:
    detail-storage: ${AUDIT_DETAIL_STORAGE:db}
  ```
- [x] **8.1.5** Create `DatabaseAuditInterceptor.java` (Hibernate interceptor)
  - Extend `EmptyInterceptor`
  - Override `onSave()`, `onFlushDirty()`, `onDelete()`
  - Log INSERT, UPDATE, DELETE on User, Role, Permission entities
  - Use `TransactionSynchronizationManager.registerSynchronization()` to save audit log AFTER main transaction commits
  - Use `RequestContextHolder.getRequestAttributes()` for request context (not injected HttpServletRequest)
  - Support configurable detail storage (db vs file mode)
  - Calculate and log field changes for UPDATE operations
- [x] **8.1.6** Create `HibernateAuditConfig.java` to register interceptor via `HibernatePropertiesCustomizer`

**Acceptance Criteria:**
- Database operations on User, Role, Permission automatically logged
- Audit logs stored with correct user context, IP, correlation ID
- Field changes captured for UPDATE operations
- No circular dependency or transaction issues

#### 8.2 Backend - Audit Log Service & API
- [x] **8.2.1** Create `AuditLogListParams.java` DTO for filter parameters:
  - userId, userEmail (LIKE search), action, resourceType
  - serviceName, success, startDate, endDate
- [x] **8.2.2** Create `AuditLogDto.java` response DTO (Java record)
- [x] **8.2.3** Create `AuditLogService.java` interface + `AuditLogServiceImpl.java` - Query only (no manual logging)
  - `getAuditLogs(params, pageable)` - List with JPA Specification filtering
  - `getAuditLog(id)` - Get single log detail
  - `exportAuditLogs(params)` - Export all matching logs
- [x] **8.2.4** Create `AuditLogController.java`
  - `GET /v1/audit-logs` - List with pagination and filtering
  - `GET /v1/audit-logs/{id}` - Get detail
  - `GET /v1/audit-logs/export` - Export
  - `@PreAuthorize("hasAuthority('admin.audit-logs:read')")` on all endpoints

**Acceptance Criteria:**
- Audit logs queryable via API with all filter options
- Export works for both CSV and JSON formats
- Pagination and sorting work correctly
- Permission enforced

#### 8.3 Backend - Proxy Audit Logging (AOP)
- [x] **8.3.1** Create `ProxyAuditAspect.java` (AOP for proxy calls)
  - Pointcut: `execution(* com.lg.microservice.admin.domain.*.controller..*(..))` (matches actual package structure)
  - Only intercept write operations: `@PostMapping`, `@PutMapping`, `@DeleteMapping`
  - **Note**: GET requests are NOT logged (per PRD: "No View Operations")
- [x] **8.3.2** Log proxy request details:
  - HTTP method, target service name, request path
  - User email (from SecurityContext via JwtAuthenticationToken)
  - Timestamp, IP address, user agent
  - Request body (extracted via `@RequestBody` annotation detection)
  - Correlation ID from `X-Correlation-ID` header
- [x] **8.3.3** Log proxy response details:
  - Success/failure status
  - Duration (milliseconds)
  - Error message (if failed)
- [x] **8.3.4** Support configurable detail storage (db vs file mode, same as DatabaseAuditInterceptor)

**Acceptance Criteria:**
- Write operations (POST, PUT, DELETE, PATCH) to proxy endpoints are logged
- GET/read operations are NOT logged
- Audit entries include all required metadata
- Correlation ID enables tracing across services

#### 8.4 Frontend - Audit Log Module
- [x] **8.4.1** Create `audit-logs.api.ts` with types and TanStack Query hooks:
  - `AuditLog` type with all fields
  - `AuditLogListParams` filter type
  - `useAuditLogs(params)` hook
  - `useAuditLog(id)` hook
  - `exportAuditLogs(params, format)` function
- [x] **8.4.2** Create `AuditLogsPage.tsx` (list page) with:
  - Data table with columns: timestamp, user, action, resourceType, resourceId, success, serviceName
  - Pagination and sorting
  - Export button (CSV/JSON dropdown)
- [x] **8.4.3** Create `AuditLogFilters.tsx` component:
  - User email filter (text input with LIKE search)
  - Action filter (CREATE, UPDATE, DELETE, POST, PUT, etc.)
  - Resource type filter (User, Role, Permission, ExternalAPI)
  - Service name filter (for proxy logs)
  - Success/failure filter
  - Date range picker (startDate, endDate)
  - Clear filters button
- [x] **8.4.4** Create `AuditLogDetailPage.tsx` (separate page, route: `/audit-logs/:id`):
  - Show all audit log fields
  - Display details JSON (changes, payload) in formatted view
  - Show request/response for proxy operations
  - Back button to return to list
- [x] **8.4.5** Add route and menu configuration for `/audit-logs/:id` detail page

**Acceptance Criteria:**
- Audit logs displayed in admin UI with all columns
- All filters work correctly
- Detail page shows full audit info including changes
- Export to CSV/JSON works from UI

#### 8.5 Frontend - Agentic System (Compliance Dashboard)
- [x] **8.5.1** Add Agentic System domain module with menu + routes
  - `/agentic-system/kpi-monitor`
  - `/agentic-system/compliance-dashboard`
- [x] **8.5.2** Port Compliance Dashboard UI
  - Project management (create/update/delete)
  - Audit runs with pass/fail/compliance summary
  - Failure drill-down and history
  - Prompt-injection panel with mock fallback
  - Data source editor + Postman-style test requests

**Acceptance Criteria:**
- Agentic System menu appears with KPI Monitor and Compliance Dashboard
- Compliance Dashboard renders with project list, runs, and drill-down
- Prompt-injection panel works with mock data when API flag is disabled

---

## Phase 9: Integration & Testing

### Objective
End-to-end integration testing and polish.

### Tasks

#### 9.1 Integration Testing
- [ ] **9.1.1** Test complete login flow (Cognito → callback → cookie → API)
- [ ] **9.1.2** Test user creation flow (Admin → Cognito → temp password)
- [ ] **9.1.3** Test password change flow (User → Cognito Hosted UI)
- [ ] **9.1.4** Test token refresh flow
- [ ] **9.1.5** Test logout flow
- [ ] **9.1.6** Test RBAC permission enforcement
- [ ] **9.1.7** Test audit logging for all operations
- [ ] **9.1.8** Test service proxy functionality
  - Proxy forwarding works correctly
  - Authorization checks enforced
  - Audit logging captures proxy calls

**Acceptance Criteria:**
- All flows work end-to-end
- No errors in happy path

#### 9.2 Error Handling
- [ ] **9.2.1** Verify error responses are consistent
- [ ] **9.2.2** Verify frontend displays errors correctly
- [ ] **9.2.3** Verify 401/403 handling

**Acceptance Criteria:**
- Errors handled gracefully
- User sees appropriate messages

#### 9.3 Documentation
- [ ] **9.3.1** Update API documentation (OpenAPI/Swagger)
- [ ] **9.3.2** Create deployment guide
- [ ] **9.3.3** Annotate all controllers with OpenAPI annotations (`@Operation`, `@ApiResponse`, `@Tag`)
- [ ] **9.3.4** Verify Swagger UI accessible and complete at `/us/common/admin/swagger-ui/index.html`

**Acceptance Criteria:**
- Documentation complete
- All endpoints documented with OpenAPI annotations
- Swagger UI shows all endpoints with descriptions
- New developers can set up project

---

## Phase 10: CRUDL Scaffolding CLI

### Objective
Create a CLI tool that generates CRUD interfaces from OpenAPI/Swagger specifications.

### Tasks

#### 10.1 CLI Tool Development
- [ ] **10.1.1** Design CLI command structure
  - `npx scaffold <resource-name>` or `pnpm scaffold <resource-name>`
  - Options: `--api-path`, `--module`, `--skip-types`, `--skip-hooks`
- [ ] **10.1.2** Create OpenAPI schema parser/introspector
  - Parse OpenAPI spec from backend
  - Extract resource schema, endpoints, request/response types
- [ ] **10.1.3** Create TypeScript type generator
  - Generate types from OpenAPI schemas
  - Support nested objects, arrays, enums
- [ ] **10.1.4** Create React component templates
  - `ResourceListPage.tsx` template
  - `ResourceCreatePage.tsx` template
  - `ResourceEditPage.tsx` template
  - `ResourceDetailPage.tsx` template
- [ ] **10.1.5** Create TanStack Query hooks generator
  - Generate `useResources()`, `useResource(id)`, `useCreateResource()`, etc.
- [ ] **10.1.6** Create route registration generator
  - Add routes to router configuration
- [ ] **10.1.7** Create navigation item generator
  - Add sidebar navigation items
- [ ] **10.1.8** Test scaffolding with sample resource
  - Scaffold a test resource end-to-end
  - Verify generated code compiles and works
- [ ] **10.1.9** Document CLI usage and customization
  - Usage examples
  - Template customization guide

**Acceptance Criteria:**
- CLI generates working CRUD pages from OpenAPI spec
- Generated TypeScript types match API schema
- Generated hooks work with TanStack Query
- Generated components follow ShadCN UI patterns
- Routes and navigation auto-registered
- Documentation complete

---

## Progress Tracking

### Legend
- [ ] Not started
- [~] In progress / Partial (boilerplate exists, needs completion)
- [x] Completed
- [-] Blocked/Skipped

### Summary

| Phase | Status | Completed | Partial | Total | % |
|-------|--------|-----------|---------|-------|---|
| Phase 0: Project Setup | **Complete** | 12 | 0 | 12 | 100% |
| Phase 1: Backend Foundation | **Complete** | 17 | 0 | 17 | 100% |
| Phase 2: Authentication | **Complete** | 15 | 0 | 15 | 100% |
| Phase 3: Frontend Foundation | **Complete** | 26 | 0 | 26 | 100% |
| Phase 4: Service Proxy Layer | **Complete** | 22 | 0 | 22 | 100% |
| Phase 5: User Management | **Complete** | 17 | 0 | 17 | 100% |
| Phase 6: RBAC & UI Standardization | **Complete** | 28 | 0 | 28 | 100% |
| Phase 7: User Profile | **Complete** | 3 | 0 | 3 | 100% |
| Phase 8: Audit Logging | Not Started | 0 | 0 | 21 | 0% |
| Phase 9: Integration & Testing | Not Started | 0 | 0 | 15 | 0% |
| Phase 10: CRUDL Scaffolding CLI | Not Started | 0 | 0 | 9 | 0% |
| **TOTAL** | **In Progress** | **140** | **0** | **185** | **76%** |

**Note**: "Partial" items indicate existing boilerplate that needs enhancement or completion.

---

## Notes

### Docker-First Development (CRITICAL)

**All commands must be run through Docker containers:**
```bash
# Backend
docker-compose exec backend ./gradlew <command>

# Frontend (pnpm)
docker-compose exec frontend pnpm <command>
docker-compose exec frontend pnpm dlx <command>
```

**Never run directly on host machine:**
- ❌ `pnpm install` (use Docker)
- ❌ `./gradlew build` (use Docker)
- ❌ `pnpm dlx shadcn@latest add` (use Docker)

### Tailwind CSS v4 Notes

- **No config files**: Tailwind v4 uses CSS-first configuration
- **Vite plugin**: Uses `@tailwindcss/vite` instead of PostCSS
- **Theme in CSS**: Colors defined in `index.css` via `@theme inline`
- **Animations**: Uses `tw-animate-css` package (not `tailwindcss-animate`)
- **ShadCN compatibility**: CSS variables wrapped in `hsl()` in `:root`

### Dependencies

- **AWS Cognito**: User Pool must be configured before Phase 2
- **Environment Variables**: Cognito client ID, user pool ID, issuer URI required
- **LG Common Libraries**: Must be available in Maven repository

### Risks

| Risk | Mitigation |
|------|------------|
| Cognito configuration issues | Test with AWS Console first, document all settings |
| Token Handler Pattern complexity | Start with simple proxy, add features incrementally |
| Permission granularity | Start with basic permissions, extend as needed |

### Documentation Updates (2025-02-10)

The following updates were made:

**Backend - Sample Items Service Enhancements:**
- Added server-side sorting with field comparators (id, name, status, createdAt, updatedAt)
- Added server-side filtering (status enum filter, text search across name and description)
- Added query, status, sort parameters to all layers (Controller → Service → Feign → Mock)
- Added bulk delete endpoint (DELETE /v1/sample/items with { ids }) across all layers
- Created `BulkDeleteRequest.java` DTO record

**TRD.md Major Rewrite:**
- Replaced outdated "Admin Module CRUDL Implementation" section with comprehensive "CRUDL Standard Pattern"
- Documented canonical reference pattern (Sample Items module) with all 9 required features
- Added complete code examples: search, filter, column visibility, row actions, sorting, pagination, bulk actions
- Added Standard Form Page Pattern (unified Create/Edit/View) with mode detection
- Updated Table of Contents to reflect new section structure

### Documentation Updates (2025-02-05)

The following documentation was updated to reflect recent architecture changes:

**TRD.md Updates:**
- Path aliases section: Removed `@framework/`, added `@core/` pointing to `src/framework/core/`
- Auto-discovery section: Documented 3-level menu support with hierarchical ID convention
- Added `MenuItem` interface documentation with full examples
- Added folder structure for multi-level menu modules
- Documented sidebar recursive rendering and breadcrumb behavior
- API response format: Documented actual `PageResponse` and `DataResponse` structures

**frontend/AGENTS.md Updates:**
- Updated path aliases to match current configuration

**frontend/README.md Updates:**
- Complete rewrite with comprehensive module development guide
- Step-by-step instructions for creating new domain modules
- Menu configuration examples (single-level and multi-level)
- Route configuration patterns with ProtectedRoute/MainLayout
- API layer patterns with TanStack Query hooks
- Example list page and form page implementations

### Documentation Updates (2025-02-11)

**Phase 6 UI Standardization Completed:**
- Standardized List Page Layout across UsersPage, RolesPage, Sample Items
- Standardized Form Page Layout with Card wrapper and centered content
- Simplified route configuration to use RouteConfig[] pattern
- Fixed Switch component styling (ON=primary, OFF=gray-400)
- Fixed admin badge text visibility in RolesPage
- Updated TRD.md with layout diagrams

**Phase 7 User Profile Completed:**
- Backend: Added `GET /v1/auth/change-password` endpoint returning Cognito Hosted UI URL
- Frontend: Implemented `ProfilePage.tsx` with user info display, roles badges, change password and logout buttons
- Frontend: Added Change Password option to AppSidebar dropdown menu

---

**Document Status**: Ready for Implementation  
**Last Updated**: 2025-02-11  
**Owner**: [To be assigned]
