# Frontend - Universal Admin Framework

## Folder Structure

```
frontend/
└── src/
    ├── framework/                 # 🔒 FRAMEWORK TEAM
    │   ├── core/                  # Pure infrastructure (NO routes/menu)
    │   │   ├── auth/              # Authentication (BFF pattern)
    │   │   ├── layout/            # Layout components
    │   │   ├── pages/             # Framework pages (Login, Home, etc.)
    │   │   ├── components/        # Error boundaries, Loading, etc.
    │   │   └── navigation/        # Auto-discovery engine
    │   └── domain/                # Framework features WITH routes/menu
    │       ├── user/              # User Management module
    │       │   ├── users/
    │       │   ├── roles/
    │       │   ├── permissions/
    │       │   └── profile/
    │       └── audit-logs/
    ├── shared/                    # 🔒 FRAMEWORK TEAM (utilities)
    │   ├── components/ui/         # ShadCN components
    │   ├── hooks/
    │   ├── lib/
    │   └── utils/
    └── domain/                    # 🔓 DOMAIN TEAMS
        └── {service-name}/        # Each business domain module
            ├── menu.tsx           # Menu configuration
            ├── routes.tsx         # Route definitions
            ├── api/
            ├── pages/
            └── components/
```

## Route Architecture

Each domain module exports `routes.tsx` and `menu.tsx` that the navigation engine discovers:

```tsx
// src/domain/communication/routes.tsx
export const communicationRoutes = (
  <>
    <Route path="/communication/templates" element={...} />
    <Route path="/communication/flows" element={...} />
    <Route path="/communication/transactions" element={...} />
  </>
)

// src/domain/communication/menu.tsx
export const communicationMenu = {
  label: 'Communication',
  icon: 'mail',
  items: [
    { label: 'Templates', href: '/communication/templates' },
    { label: 'Flows', href: '/communication/flows' },
  ]
}

// src/framework/core/navigation/useModuleDiscovery.ts
// Auto-discovers and registers routes + menu from domain modules
```

## Path Aliases

```typescript
@/          → src/              // ShadCN convention (internal use)
@core/      → src/framework/core/   // Framework core (auth, layout, navigation)
@domain/    → src/domain/       // Cross-domain imports
@shared/    → src/shared/       // Shared components, utilities
```

**Note:** The `@framework/` alias was removed. Use `@core/` for framework core imports.

## State Management

| Type | Tool | Usage |
|------|------|-------|
| Global | Zustand | Auth, theme, user preferences |
| Server | TanStack Query | API data, caching, sync |
| Form | React Hook Form + Zod | Form state and validation |

## Commands

```bash
# Add dependency
docker-compose exec frontend pnpm add <package>

# Add ShadCN component
docker-compose exec frontend pnpm dlx shadcn@latest add <component>

# Build
docker-compose exec frontend pnpm run build

# Lint
docker-compose exec frontend pnpm run lint
```

## UI Components (STRICT)

- **ShadCN UI Only**: No other UI libraries allowed
- **Custom Components**: Must extend ShadCN patterns
- **Data Tables**: TanStack Table with ShadCN styling
- **Styling**: Tailwind CSS only (no CSS modules, styled-components)

## Tailwind v4 Notes

- **No config file**: CSS-first configuration
- **Theme in CSS**: `@theme` directive in `index.css`
- **Vite plugin**: Uses `@tailwindcss/vite`
- **Animations**: `tw-animate-css` package

## Auth Flow

1. Frontend is provider-agnostic (no Cognito SDK)
2. Login: Redirect to `/api/v1/auth/login`
3. Tokens stored in HttpOnly cookies (set by backend)
4. All API calls include cookies (`withCredentials: true`)
5. Backend validates tokens, frontend just checks auth state
6. API base URL: `/api/v1` (axios configured with version prefix)

## Conventions

1. **TypeScript**: Strict mode enabled
2. **Functional Components**: Always use function components with hooks
3. **Naming**: PascalCase for components, camelCase for hooks/utils
4. **Module Pattern**: 
   - **framework/core/** - Pure infrastructure (auth, layout, shared pages)
   - **framework/domain/** - Framework features (user mgmt, audit logs)
   - **domain/{service}/** - Business domain modules (communication, orders, etc.)
5. **Routes & Menu**: Each domain module exports `routes.tsx` (routes) and `menu.tsx` (navigation items)
6. **Auto-Discovery**: Navigation engine discovers and registers routes from all domain modules
