# Product Requirements Document (PRD)
## Universal Admin Framework

**Version:** 1.0  
**Date:** 2025-12-01  
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Product Vision & Goals](#product-vision--goals)
3. [Architecture Overview](#architecture-overview)
4. [Core Features & Requirements](#core-features--requirements)
5. [UI/UX Requirements](#uiux-requirements)
6. [Non-Functional Requirements](#non-functional-requirements)
7. [Security & Compliance](#security--compliance)
8. [Scalability & Performance](#scalability--performance)

> **Note**: For detailed technical specifications, architecture diagrams, API documentation, and implementation details, see [Technical Requirements Document (TRD)](./TRD.md).

---

## Executive Summary

The Universal Admin Framework is an admin platform designed to provide a unified administrative interface for managing multiple microservices within an organization. Unlike traditional admin solutions that require individual implementations for each service, this framework provides a centralized, extensible platform that can be configured to support new services with minimal code changes (typically configuration-only).

The framework consists of two primary components:
- **Frontend Application**: A React-based admin interface built with Vite, ShadCN UI, TypeScript, and Zustand for state management
- **Backend Admin Application**: A Spring Boot-based application that provides admin features (user management, RBAC/ACL, audit logs) and acts as a centralized authorization layer and proxy to downstream microservices

This solution addresses the challenge of managing numerous microservices that lack built-in admin interfaces, providing a single, consistent administrative experience across all services while maintaining security, scalability, and extensibility.

---

## Product Vision & Goals

### Vision Statement
To create a universal admin framework that enables organizations to provision administrative interfaces for any microservice within 1-2 days, reducing development time, ensuring consistent user experience, and maintaining centralized security and access control.

### Primary Goals

1. **Unified Admin Experience**: Provide a single, consistent admin interface for managing all microservices
2. **Service Integration**: Enable adding new services to the admin platform with minimal configuration (typically configuration-only, no code changes)
3. **Security**: Implement authentication, authorization, and audit capabilities with OAuth2/OIDC, RBAC/ACL, and comprehensive audit logging
4. **Developer Productivity**: Reduce time-to-market for admin interfaces through auto-scaffolding and modular architecture
5. **Customization & Flexibility**: Support UI customization including layouts, component styling, and custom field types to meet diverse business requirements
6. **Scalability**: Design for growth, supporting hundreds of services and thousands of users

### Success Criteria

---

## Architecture Overview

### High-Level Architecture

The Universal Admin Framework consists of three main components:

1. **Frontend Application**: A React-based admin interface with modular architecture
2. **Backend Admin Application**: A Spring Boot application providing admin features and service proxy capabilities
3. **PostgreSQL Database**: Stores admin domain data (users, roles, permissions, audit logs)

### Key Architectural Principles

1. **Backend is a Full Admin Application**
   - Not merely a gateway - has its own domain logic and database
   - Provides core admin features: user management, RBAC/ACL, audit logs
   - Also acts as an authorized proxy to downstream microservices

2. **Modular Frontend**
   - Each service module is self-contained
   - Independent code splitting per module
   - Module-specific state stores to prevent bundle bloat
   - Lazy loading of modules

3. **Centralized Authorization**
   - All authorization checks happen server-side
   - RBAC/ACL managed in backend database
   - Service proxy validates permissions before forwarding requests

### Request Flow

**For Admin Features (User Management, RBAC, Audit Logs):**
1. Frontend makes request to Backend Admin API
2. Backend validates authentication token
3. Backend checks RBAC/ACL permissions
4. Backend executes admin operation
5. Backend logs audit event
6. Backend returns response to frontend

**For Service Proxy Requests:**
1. Frontend makes request to Backend Admin API (proxy endpoint)
2. Backend validates authentication token
3. Backend checks RBAC/ACL permissions
4. Backend logs audit event (request)
5. Backend forwards request to target microservice
6. Backend receives response from microservice
7. Backend logs audit event (response)
8. Backend forwards response to frontend

> **For detailed technical architecture, technology stack, database schema, API specifications, and implementation details, see [Technical Requirements Document (TRD)](./TRD.md).**

---

## Core Features & Requirements

### 1. Authentication

#### Requirements

- **Default Provider**: AWS Cognito Hosted UI (pre-built, ships with framework as the default authentication provider)
- **Modular Architecture**: Provider-agnostic auth system with `AuthProvider` interface
- **Active Providers**:
  - **Cognito**: Full OAuth2/OIDC flow for direct admin login
  - **Magento**: Token-only validation for embedded iframe access
- **Extensibility**: Support for additional authentication providers (Auth0, Keycloak, custom OAuth2/OIDC)
- **Authentication Flow**: OAuth2/OIDC Authorization Code Flow with PKCE (Cognito), JWT validation (Magento)
- **Session Management**: JWT-based sessions with refresh token support
- **Token Storage**: 
  - Access token in JavaScript memory (Zustand store) — never persisted
  - Refresh token in HttpOnly cookie (XSS-proof, survives page refresh)
- **Embed Mode**: Support for rendering admin pages in iframes (Magento admin integration)

#### Functional Requirements

- User login via hosted UI (Cognito Hosted UI by default, configurable)
- Automatic token refresh via backend endpoint when access token expires
- Logout functionality (clear cookies, optionally revoke token at provider)
- Session timeout handling
- Multi-factor authentication support (via provider)
- Password reset/change flow (via Cognito Hosted UI)
- User synchronization: Automatic sync of user information from auth provider to local database on OAuth callback
- Embed mode: Frameless UI rendering when `?embed` query param is present

#### Authorization

- **100% Database-Driven**: All roles and permissions stored in PostgreSQL
- **No JWT Claims for Authorization**: JWT groups/scopes are ignored; authorization comes from `userService.getUserAuthorities()`
- **User Must Exist**: API calls require user to exist in database (created during OAuth callback or manually by admin)

#### Security Architecture

- **BFF (Backend-for-Frontend) Pattern**: Frontend interacts only with `/api/v1/auth/*` endpoints
- **XSS Protection**: Access token in memory (not localStorage), refresh token in HttpOnly cookie
- **CSRF Protection**: SameSite=Lax cookies; embed flow uses no cookies (token in URL)
- **PKCE Handling**: Backend generates and validates PKCE codes (not frontend)
- **Embed Security**: Token stripped from URL immediately, postMessage origin validation

> **For technical implementation details, see [TRD.md](./TRD.md).**

### 2. User Management

#### Requirements

- **Integration**: Backend maintains local user records integrated with Cognito
- **Purpose**: Manage users, sync with Cognito, assign roles and permissions
- **Scope**: User management is a core admin feature provided by the backend application

#### Functional Requirements

- **User Synchronization**:
  - Sync users from Cognito to local database
  - Automatic sync on login/authentication
  - Manual sync trigger
  - Handle user creation/deletion in Cognito

- **User CRUDL Operations** (Create, Read, Update, Delete, List):
  - **List**: List users with pagination, filtering, and sorting
  - **View**: View user details including roles, permissions, and activity
  - **Create**: Create user (triggers Cognito user creation)
  - **Update**: Update user information, assign/remove roles
  - **Delete**: Delete users (removes from local database and Cognito)
  - **User Activity Tracking**: Track last login time, last activity time, and login count

- **Cognito Integration**:
  - User creation in Cognito via Admin API (AdminCreateUser with temporary password)
  - User attribute management
  - Password reset initiation
  - User status synchronization

- **User Creation Flow**:
  1. Admin creates user via admin interface (email, temporary password, name, roles)
  2. Backend calls Cognito AdminCreateUser with `temporaryPassword`
  3. User created in Cognito with `FORCE_CHANGE_PASSWORD` status
  4. User saved to local database with `external_user_id` (Cognito sub)
  5. Admin shares temporary password with user out of band
  6. User logs in via Cognito Hosted UI → prompted to change password
  7. User sets new password → status becomes `CONFIRMED`
  8. User sync to local DB happens on first successful login

> **For data model details and API specifications, see [TRD.md](./TRD.md).**

### 3. User Profile (Self-Service)

#### Requirements

- **Purpose**: Allow authenticated users to view their profile, change their password, and log out
- **Password Management**: Delegated to Cognito Hosted UI (consistent with login flow)

#### Functional Requirements

- **View Profile**:
  - Display current user's email, name, and assigned roles
  - Display account status and last login information

- **Change Password**:
  - Redirect to Cognito Hosted UI for password change
  - Cognito handles current password verification and new password validation
  - No custom password form in the application (delegated to Cognito)

- **Logout**:
  - Clear auth cookies (access_token, refresh_token)
  - Optionally revoke refresh token at Cognito
  - Redirect to login page

> **For implementation details, see [TRD.md](./TRD.md).**

### 4. Role-Based Access Control (RBAC)

#### Requirements

- **Scope**: Fully managed within the backend admin application database
- **Storage**: Roles and permissions stored in PostgreSQL database
- **Granularity**: Role and permission-based
- **Hierarchy**: Support for role hierarchies (optional)
- **Assignment**: Users can have multiple roles

#### Functional Requirements

- **Role Management** (CRUDL - Create, Read, Update, Delete, List):
  - **List**: List roles with pagination, filtering, and sorting
  - **View**: View role details including assigned permissions
  - **Create**: Create roles with name and description
  - **Update**: Update role information, assign/remove permissions
  - **Delete**: Delete roles (with validation to prevent deletion if assigned to users)
  - **Permission Assignment**: Assign permissions to roles, remove permissions from roles via Permission Tree UI
  - **Permission Tree UI**: Hierarchical tree display of all permissions grouped by resource (module), with checkboxes for selection/deselection. Supports dot-notated resources (e.g., `admin.users`, `reports.sales`) for dynamic hierarchy depth.
  - **Role Hierarchy**: Support for role hierarchies (e.g., Admin inherits Editor permissions) - optional

- **Permission Management** (CRUDL - Create, Read, Update, Delete, List):
  - **List**: List permissions with pagination, filtering, and sorting
  - **View**: View permission details
  - **Create**: Create permissions with resource-action pairs
  - **Update**: Update permission information
  - **Delete**: Delete permissions (with validation to prevent deletion if assigned to roles)
  - **Wildcard Support**: Support for wildcard permissions (`*:read`, `users:*`, `*:*`)

- **User-Role Assignment**:
  - Assign roles to users
  - Remove roles from users
  - View user's assigned roles and permissions
  - Bulk role assignment

- **Authorization Enforcement**:
  - Permission checking at API endpoint level (Spring Security `@PreAuthorize`)
  - Permission checking at UI component level (frontend guards)
  - Real-time permission evaluation
  - Route-level protection based on roles and permissions

#### Permission Format

- Format: `{resource}:{action}` (e.g., `users:read`, `orders:write`)
- Wildcard support: `*:read` (read all resources)
- Scope support: `users:read:own` (read own users only)

> **For data model details and API specifications, see [TRD.md](./TRD.md).**

### 5. Access Control Lists (ACL)

#### Requirements

- **Purpose**: Fine-grained access control beyond RBAC
- **Use Cases**: 
  - Resource-level permissions
  - Field-level access control
  - Conditional access based on resource attributes

#### Functional Requirements

- Define ACL rules per resource type
- Support for resource ownership checks
- Field-level permission checks
- Dynamic permission evaluation based on resource state

> **For ACL implementation details, see [TRD.md](./TRD.md).**

### 6. Audit Logging

#### Requirements

- **Storage**: Audit logs stored in backend PostgreSQL database
- **Management**: Audit log management is a core admin feature provided by the backend
- **Scope**: Log all administrative actions (both admin features and service proxy requests)
- **Retention**: Configurable retention period (default: 1 year)
- **Searchability**: Full-text search and filtering
- **Compliance**: Support for compliance requirements (GDPR, SOC2, etc.)

#### Functional Requirements

- **Automatic Logging** (No Manual Code Required):
  - **Database Operations**: Automatically log all INSERT, UPDATE, DELETE operations on admin entities (users, roles, permissions) via Hibernate interceptor
  - **API Proxy Operations**: Automatically log all external API calls through proxy layer via AOP interceptor
  - **No View Operations**: Read/GET operations are not logged to avoid database bloat
  - **Configurable Detail Storage**: Choose where detailed logs are stored:
    - **DB Mode**: Store all details (including payloads/changes) in database
    - **File Mode**: Store minimal info in DB, detailed logs go to application logs (New Relic)

- **Audit Log Management** (CRUDL - Create, Read, Update, Delete, List):
  - **List**: View audit logs in admin interface with pagination, filtering, and sorting
  - **View**: View audit log entries including user, action, resource, IP address, correlation ID
    - If detail-storage=db: View full details including payloads/changes in admin UI
    - If detail-storage=file: View minimal info in admin UI, detailed logs available in New Relic
  - **Filter**: Filter by user, action, resource type, date range, IP address, service name
  - **Search**: Search audit logs (full-text search)
  - **Export**: Export audit logs (CSV, JSON)
  - **Archive**: Archive old audit logs (admin only)
  - **Real-time Streaming**: Real-time audit log streaming (optional)

> **For data model details, implementation approach, and API specifications, see [TRD.md](./TRD.md).**

### 7. CRUDL Auto-Scaffolding

#### Requirements

- **Purpose**: Generate CRUD interfaces for any resource from API endpoint definitions
- **Scope**: Create, Read, Update, Delete, List operations
- **Customization**: Fully customizable after generation

#### Functional Requirements

- Generate CRUD pages from service endpoint definitions
- Auto-detect resource schema from API responses
- Generate forms with validation
- Generate data tables with pagination, sorting, filtering
- Support for nested resources
- Support for file uploads
- Support for rich text editors
- Custom field types and widgets

#### Scaffolding Process

1. Define service endpoint configuration
2. Framework introspects API schema (OpenAPI/Swagger preferred)
3. Generate TypeScript types
4. Generate React components (List, Create, Edit, Show)
5. Generate API client hooks (TanStack Query)
6. Register routes and navigation

> **For technical implementation details and configuration examples, see [TRD.md](./TRD.md).**

---

## UI/UX Requirements

### Design System

#### Component Library: ShadCN UI (Strict Policy)

- **Rationale**: Copy-paste model allows full source code control, built on Radix UI primitives, large community ecosystem
- **Base**: Radix UI primitives for accessibility
- **Styling**: Tailwind CSS for utility-first styling
- **Theming**: CSS variables for styling consistency and customization

**ShadCN UI Strict Policy**:
- **ONLY** ShadCN UI components are allowed for UI development
- **NO** other UI component libraries (Material UI, Ant Design, Chakra, etc.)
- Custom components **MUST** follow ShadCN patterns and Radix primitives
- All components live in `src/shared/components/ui/` directory

#### Design Principles

1. **Consistency**: Unified design language across all modules
2. **Accessibility**: WCAG 2.1 AA compliance
3. **Responsiveness**: Mobile-first design approach
4. **Performance**: Optimized rendering and lazy loading

### Core UI Features

#### 1. Responsive Design

- **Breakpoints**: 
  - Mobile: < 768px
  - Tablet: 768px - 1024px
  - Desktop: > 1024px
- **Mobile Navigation**: Collapsible sidebar, bottom navigation (optional)
- **Touch-Friendly**: Touch targets minimum 44x44px

#### 2. Layout Components

- **Sidebar Navigation**: Collapsible, hierarchical menu
- **Top Bar**: User menu, notifications, search
- **Breadcrumbs**: Navigation context
- **Footer**: Optional footer with links/info

#### 3. Data Display Components

- **Data Tables**: 
  - Pagination
  - Sorting (multi-column)
  - Filtering (column-specific)
  - Column visibility toggle
  - Export functionality
  - Row selection
- **Cards**: For dashboard and summary views
- **Lists**: For simple data display
- **Charts**: Integration with charting libraries (recharts, etc.)

#### 4. Form Components

- **Input Fields**: Text, email, number, password, etc.
- **Select/Dropdown**: Single and multi-select
- **Date/Time Pickers**: Date, time, datetime
- **File Upload**: Drag-and-drop, progress indicator
- **Rich Text Editor**: WYSIWYG editor integration
- **Form Validation**: Real-time validation with error messages

#### 5. Feedback Components

- **Toasts**: ShadCN Toast component for success, error, warning, info feedback messages
- **Loading States**: Skeletons, spinners, progress bars
- **Empty States**: Display messages explaining why no data is shown and what actions are available
- **Error Boundaries**: Display error messages and recovery options instead of crashing the application

#### 6. Navigation Features

- **Search**: Global search across resources
- **Quick Actions**: Keyboard shortcuts for common actions
- **Recent Items**: Quick access to recently viewed items
- **Favorites**: Bookmark frequently used resources

### User Experience Enhancements

- **Keyboard Shortcuts**: Common actions (Ctrl+K for search, etc.)
- **Bulk Operations**: Select multiple items for batch actions
- **Undo/Redo**: For form edits (where applicable)
- **Auto-save**: Draft saving for forms
- **Offline Support**: Basic offline functionality (future)

---

## Non-Functional Requirements

### Performance

- **Page Load Time**: < 2 seconds for initial load
- **Time to Interactive**: < 3 seconds
- **API Response Time**: < 500ms for 95th percentile
- **Bundle Size**: < 500KB initial bundle (gzipped)
- **Code Splitting**: Each module loaded on-demand

### Scalability

- **Concurrent Users**: Support 1000+ concurrent users
- **Services**: Support 100+ registered services
- **Data Volume**: Handle millions of records with pagination
- **Horizontal Scaling**: Backend should scale horizontally

### Reliability

- **Uptime**: 99.9% availability target
- **Error Handling**: Display user-friendly error messages and fallback UI when services fail
- **Circuit Breaker**: Prevent cascade failures
- **Retry Logic**: Automatic retry for transient failures

### Maintainability

- **Code Quality**: TypeScript strict mode, ESLint, Prettier
- **Testing**: 
  - Unit tests: > 80% coverage
  - Integration tests for critical flows
  - E2E tests for user journeys
- **Documentation**: API documentation (OpenAPI/Swagger) and component documentation (Storybook or similar)
- **Logging**: Structured logging for debugging

### Browser Support

- **Modern Browsers**: Chrome, Firefox, Safari, Edge (last 2 versions)
- **Mobile Browsers**: iOS Safari, Chrome Mobile
- **No IE11 Support**: Modern JavaScript features required

---

## Security & Compliance

### Security Requirements

#### Authentication Security

- **Token Storage**: Secure token storage using httpOnly cookies (tokens not accessible to JavaScript)
- **Token Expiration**: Short-lived access tokens (1 hour default)
- **Refresh Tokens**: Long-lived refresh tokens (30 days default) stored in httpOnly cookies
- **Token Refresh**: Automatic token refresh via backend endpoint when access token expires
- **CSRF Protection**: CSRF tokens for state-changing operations
- **XSS Protection**: Content Security Policy (CSP) headers

#### Authorization Security

- **Principle of Least Privilege**: Default deny, explicit allow
- **Permission Validation**: Server-side validation (never trust client)
- **Role Escalation Prevention**: Prevent users from elevating roles
- **API Rate Limiting**: Prevent abuse and DoS attacks

#### Data Security

- **Encryption in Transit**: TLS 1.2+ for all communications
- **Encryption at Rest**: Encrypt sensitive data in database
- **PII Handling**: Encrypt PII at rest, mask PII in logs and UI displays (passwords, SSNs, credit card numbers)
- **Data Masking**: Mask sensitive data in logs and UI (passwords, tokens, PII)

#### Audit & Monitoring

- **Security Event Logging**: All security-relevant events logged
- **Intrusion Detection**: Monitor for suspicious activities
- **Vulnerability Scanning**: Regular dependency updates and scanning
- **Penetration Testing**: Annual security audits

### Compliance Considerations

- **GDPR**: Right to access, right to deletion, data portability
- **SOC 2**: Audit logging, access controls, change management
- **HIPAA** (if applicable): PHI handling, access controls, audit trails

---

## Scalability & Performance

### Frontend Scalability

#### Code Splitting Strategy

- **Route-based Splitting**: Each module loaded on route access
- **Component-based Splitting**: Large components lazy-loaded
- **Vendor Splitting**: Separate vendor chunks for caching
- **Dynamic Imports**: Use React.lazy() and dynamic imports

#### State Management Scalability

- **Module Isolation**: Each module has independent state store
- **Selective Subscriptions**: Components subscribe only to needed state
- **Memoization**: Use React.memo, useMemo, useCallback for expensive computations and component re-renders

#### Asset Optimization

- **Image Optimization**: Lazy loading, responsive images, WebP format
- **Font Optimization**: Subset fonts, preload critical fonts
- **CSS Optimization**: Purge unused CSS, critical CSS inlining

### Backend Scalability

#### Database Optimization

- **Indexing**: Indexes on foreign keys, frequently filtered columns, and search fields
- **Query Optimization**: Use JOINs instead of multiple queries, avoid N+1 problems with batch loading
- **Connection Pooling**: Optimize database connections
- **Read Replicas**: Use read replicas for read-heavy workloads

#### Caching Strategy

- **API Response Caching**: Cache frequently accessed data
- **Permission Caching**: Cache user permissions (with invalidation)
- **Service Metadata Caching**: Cache service definitions

#### Horizontal Scaling

- **Stateless Design**: Backend should be stateless
- **Session Storage**: External session store (Redis)
- **Load Balancing**: Support for load balancers
- **Service Mesh**: Consider service mesh for complex routing, observability, and security requirements

### Performance Monitoring

- **Frontend Monitoring**: 
  - Web Vitals (LCP, FID, CLS)
  - Error tracking (Sentry, etc.)
  - Performance metrics
- **Backend Monitoring**:
  - API response times
  - Error rates
  - Resource utilization
  - Database query performance

---

**Document Status**: Draft  
**Next Review Date**: [To be determined]  
**Owner**: [To be assigned]  
**Stakeholders**: [To be identified]
