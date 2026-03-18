# Communication Service - Technical Requirements Document

## Overview
The Communication module provides email template management, flow orchestration, transaction tracking, and reporting capabilities.

## Architecture

### Backend Structure

```
backend/src/main/java/com/lg/microservice/admin/domain/communication/
├── controller/
│   └── CommunicationController.java    # Proxy controller for all communication endpoints
└── feign/
    └── CommunicationFeignClient.java   # Feign client interface to communication service
```

### Frontend Structure

```
frontend/src/domain/communication/
├── templates/
│   ├── api/
│   │   └── templates.api.ts      # Template API calls
│   ├── components/
│   │   └── email-editor/         # GrapesJS MJML editor
│   │       ├── App.tsx
│   │       ├── mjml-browser.d.ts # Type definitions
│   │       └── ...
│   └── pages/
│       ├── index.tsx             # Template list page
│       └── EmailTemplateBuilder.tsx
├── flows/
│   ├── api/
│   │   └── flows.api.ts          # Flow API calls
│   ├── components/
│   │   └── flow-builder/         # @xyflow/react components
│   └── pages/
│       ├── index.tsx             # Flow list page
│       ├── EmailFlowBuilder.tsx
│       └── EmailFlowReader.tsx
├── transactions/
│   ├── api/
│   │   └── transactions.api.ts   # Transaction API calls
│   └── pages/
│       └── Transactions.tsx
├── reports/
│   ├── api/
│   │   └── reports.api.ts        # Reports API calls
│   └── pages/
│       └── index.tsx
├── menu.tsx                      # Navigation menu definition
└── routes.tsx                    # Route definitions
```

### Request Flow

```
Frontend                    Backend                         External Service
   │                           │                                   │
   │  GET /api/v1/communication/templates                          │
   │─────────────────────────>│                                    │
   │                          │  GET /v1/templates                 │
   │                          │ (via CommunicationFeignClient)     │
   │                          │──────────────────────────────────>│
   │                          │                                    │
   │                          │<──────────────────────────────────│
   │<─────────────────────────│                                    │
   │                          │                                    │
```

### API Architecture

**Zero-Config Frontend**

All API calls go through the shared `apiClient` from `@shared/lib/axios`:
- Base URL: `/api/v1` (handled by apiClient)
- Communication endpoints: `/communication/{resource}`
- The backend proxies these calls to the communication microservice

**Example:**
```typescript
import apiClient from '@shared/lib/axios';

// Frontend calls: /api/v1/communication/templates
// Backend proxies to: {COMMUNICATION_SERVICE}/v1/templates
export const getTemplates = () => apiClient.get('/communication/templates');
```

**Backend Proxy Pattern**

The backend uses Spring Cloud OpenFeign for type-safe HTTP proxying:

```java
@FeignClient(
    name = "CommunicationFeignClient",
    url = "${microservice.communication}",
    configuration = AuthorizationFeignInterceptor.class
)
public interface CommunicationFeignClient {
    @GetMapping("/templates")
    Object getTemplates(...);
}
```

Authorization headers are automatically propagated via `AuthorizationFeignInterceptor`.

### API Endpoints

| Frontend Request | Backend Proxy Target | Description |
|------------------|---------------------|-------------|
| `GET /api/v1/communication/templates` | `/v1/templates` | List email templates |
| `GET /api/v1/communication/templates/:id` | `/v1/templates/:id` | Get template by ID |
| `POST /api/v1/communication/templates` | `/v1/templates` | Create template |
| `PUT /api/v1/communication/templates/:id` | `/v1/templates/:id` | Update template |
| `DELETE /api/v1/communication/templates/:id` | `/v1/templates/:id` | Delete template |
| `POST /api/v1/communication/templates/:id/preview` | `/v1/templates/:id/preview` | Preview template |
| `GET /api/v1/communication/flows` | `/v1/flows` | List flows |
| `GET /api/v1/communication/flows/:id` | `/v1/flows/:id` | Get flow by ID |
| `POST /api/v1/communication/flows` | `/v1/flows` | Create flow |
| `PUT /api/v1/communication/flows/:id` | `/v1/flows/:id` | Update flow |
| `DELETE /api/v1/communication/flows/:id/delete` | `/v1/flows/:id/delete` | Delete flow |
| `PUT /api/v1/communication/flows/:id/activate` | `/v1/flows/:id/activate` | Activate/deactivate flow |
| `GET /api/v1/communication/event-sources` | `/v1/event-sources` | List event sources |
| `GET /api/v1/communication/events/metadata` | `/v1/events/metadata` | Get events metadata |
| `GET /api/v1/communication/event-groups` | `/v1/event-groups` | List event groups |
| `GET /api/v1/communication/events/:id/properties` | `/v1/events/:id/properties` | Get event properties |
| `GET /api/v1/communication/flow-executions` | `/v1/flow-executions` | List flow executions |
| `GET /api/v1/communication/flow-executions/:id` | `/v1/flow-executions/:id` | Get execution by ID |
| `GET /api/v1/communication/flow-executions/analytics` | `/v1/flow-executions/analytics` | Get execution analytics |
| `GET /api/v1/communication/api/email/stats` | `/v1/api/email/stats` | Get email statistics |

### Dependencies

**Backend:**
- Spring Cloud OpenFeign for HTTP client
- `AuthorizationFeignInterceptor` for header propagation

**Frontend:**
- `grapesjs` + `grapesjs-mjml`: Visual email template editor
- `mjml-browser`: MJML to HTML compilation
- `@xyflow/react`: Visual flow builder
- `@dagrejs/dagre`: Auto-layout for flow diagrams

## Configuration

**Frontend (Zero-Config)**

The frontend is zero-config:
- Uses shared `apiClient` with base URL `/api/v1`
- All routing is handled by nginx (production) or Vite proxy (development)
- Backend handles the actual communication service URL configuration

**Backend Configuration (application.yml)**

```yaml
microservice:
  host: http://microservice.lgcomus-dev.lge.com
  communication: ${microservice.host}/us/common/communication/v1
```

Per-environment overrides in profile sections:

| Profile | Communication Service URL |
|---------|--------------------------|
| LOCAL | `http://microservice.lgcomus-dev.lge.com/us/common/communication/v1` |
| DEV | `${microservice.host}/us/common/communication/v1` |
| QA | `${microservice.host}/us/common/communication/v1` |
| STG | `${microservice.host}/us/common/communication/v1` |
| PRD | `${microservice.host}/us/common/communication/v1` |

## Security

All `/v1/communication/**` endpoints require authentication. The `SecurityConfig` enforces:

```java
.requestMatchers("/v1/communication/**").authenticated()
```

Authorization header from the incoming request is automatically forwarded to the communication service via `AuthorizationFeignInterceptor`.
