# Admin Service (Merged)

## IMPORTANT: Documentation-Driven Development

### Before Implementation
**Always refer to these documents before implementing any feature:**
- [docs/PRD.md](docs/PRD.md) - Product requirements (the "what" and "why")
- [docs/TRD.md](docs/TRD.md) - Technical architecture, design decisions, and specifications (the "how")
- [docs/IMP.md](docs/IMP.md) - Implementation plan, progress tracking, and task status

### After Implementation Changes
**Documentation must stay in sync with code. When you:**
- **Add a feature** → Update TRD.md (specs) and IMP.md (mark task complete)
- **Modify a specification** → Update TRD.md first, then implement
- **Remove a feature** → Update PRD.md, TRD.md, and IMP.md accordingly
- **Change architecture/patterns** → Update TRD.md before or immediately after
- **Complete a task** → Mark it `[x]` in IMP.md

**The docs are the source of truth. Outdated docs = technical debt.**

## Project Overview

Universal admin platform with React frontend and Spring Boot backend, featuring AWS Cognito authentication with Token Handler Pattern, RBAC/ACL authorization, and communication management (email templates, flows, transactions).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + TypeScript + ShadCN UI + Tailwind v4 + Zustand + TanStack Query |
| Backend | Spring Boot 3.3.x + Java 21 + PostgreSQL + Redis |
| Package Manager | pnpm (frontend) |
| Auth | AWS Cognito with Token Handler Pattern |

## Project Structure

```
admin-merged/
├── backend/               # Spring Boot application
├── frontend/              # React application
│   └── src/
│       ├── core/          # Framework (auth, layout, admin, profile)
│       ├── shared/        # Shared components and utilities
│       ├── modules/       # Business domain modules
│       │   └── communication/  # Email templates, flows, APIs
│       └── pages/         # Page components
├── docs/                  # Documentation
│   ├── PRD.md            # Product requirements
│   ├── TRD.md            # Technical specifications
│   ├── IMP.md            # Implementation plan
│   └── services/
│       └── communication/  # Communication service docs
└── docker-compose.yml     # Development environment
```

## Development Commands

All commands run through Docker containers:

```bash
# Start all services
docker-compose up

# Backend
docker-compose exec backend ./gradlew compileJava
docker-compose exec backend ./gradlew test

# Frontend
docker-compose exec frontend pnpm add <package>
docker-compose exec frontend pnpm run build
docker-compose exec frontend pnpm dlx shadcn@latest add <component>
```

## Service URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080/us/common/admin |
| Communication API | Configured via VITE_COMMUNICATION_API_BASE_PATH |
| Swagger UI | http://localhost:8080/us/common/admin/swagger-ui/index.html |

## Critical Rules

1. **Docker-first**: All commands via `docker-compose exec`
2. **pnpm only**: Never use npm for frontend
3. **ShadCN UI only**: No other UI libraries (no MUI, Ant Design, etc.)
4. **Tailwind v4**: CSS-first config, no tailwind.config.js
5. **Plain JPA**: Entities don't extend DDD base classes
6. **Flyway**: Auto-migrate disabled - use `/flyway/migrate` API endpoint
7. **No Amplify**: Frontend uses BFF pattern, no direct Cognito SDK
8. **API Versioning**: All endpoints use `/v1` prefix (e.g., `/v1/auth/me`, `/v1/admin/users`)

## Module Architecture

### Core (Framework)
- `core/auth/` - Authentication (BFF pattern, cookie-based)
- `core/layout/` - Layout components (MainLayout, Header, Sidebar)
- `core/admin/` - User, role, permission management
- `core/profile/` - User profile self-service
- `core/pages/` - Login, Home, Dashboard, NotFound

### Communication Module
- `modules/communication/email-templates/` - GrapesJS MJML editor
- `modules/communication/flow-builder/` - @xyflow/react flow designer
- `modules/communication/api/` - Communication service APIs
- `pages/communication/` - Templates, Flows, Transactions, Reports pages

## Path Aliases

```typescript
@/       → src/
@core    → src/core/
@shared  → src/shared/
@modules → src/modules/
```

## Key Documentation

| Document | Purpose | Update When |
|----------|---------|-------------|
| [PRD.md](docs/PRD.md) | Product requirements | Requirements change |
| [TRD.md](docs/TRD.md) | Technical architecture | Architecture/specs change |
| [IMP.md](docs/IMP.md) | Implementation progress | Tasks complete/change |
| [Communication TRD](docs/services/communication/TRD.md) | Communication module specs | Module specs change |
