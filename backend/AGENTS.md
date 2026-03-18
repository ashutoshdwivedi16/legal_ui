# Backend - Universal Admin Framework

## IMPORTANT: Before Any Implementation

**Always refer to these documents before implementing any feature:**
- [../docs/TRD.md](../docs/TRD.md) - Technical architecture, design decisions, and specifications
- [../docs/IMP.md](../docs/IMP.md) - Implementation plan, progress tracking, and task status

## Package Structure

```
src/main/java/com/lg/microservice/admin/
├── AdminServiceApplication.java
├── common/                        # Pure infrastructure (no business logic)
│   ├── config/                   # RestTemplateConfig, AuthorizationFeignInterceptor
│   ├── exception/                # RestCustomException, ErrorCode, RestExceptionHandler
│   ├── response/                 # DataResponse, PageResponse, ErrorResponse
│   ├── security/                 # SecurityConfig, MethodSecurityConfig, CustomPermissionEvaluator
│   └── validator/                # Custom validators
├── utils/                         # Static utility helpers
├── core/                          # Framework module (auth, user, rbac) - internal logic
│   ├── controller/               # AuthController
│   ├── service/                  # Service interfaces
│   │   ├── AuthService.java      # Auth operations interface
│   │   ├── UserService.java      # User operations interface
│   │   ├── UserSyncService.java  # User sync interface
│   │   ├── AuthStateStore.java   # PKCE state management (infrastructure component)
│   │   └── impl/                 # Service implementations
│   │       ├── AuthServiceImpl.java
│   │       ├── UserServiceImpl.java
│   │       └── UserSyncServiceImpl.java
│   ├── repository/               # UserRepository, RoleRepository
│   ├── model/
│   │   ├── entity/               # User, Role, Permission (plain JPA)
│   │   └── dto/                  # TokenResponse, LoginUrlResponse, etc.
│   └── factory/                  # AuthProvider, AuthProviderFactory
│       └── provider/             # CognitoAuthProvider, CognitoJwtAuthenticationConverter
└── domain/                        # Business domains (service integrations - external proxies)
    ├── sample/                   # Sample service (reference implementation)
    │   ├── controller/
    │   │   ├── SampleController.java      # /v1/sample/** → SampleService
    │   │   └── SampleMockController.java  # /mock/sample/** → in-memory data
    │   ├── service/
    │   │   ├── SampleService.java         # Service interface
    │   │   └── impl/
    │   │       └── SampleServiceImpl.java # @Service, calls FeignClient
    │   ├── feign/
    │   │   └── SampleFeignClient.java     # Feign client interface
    │   ├── dto/
    │   │   └── ...                        # DTOs for the domain
    │   └── store/
    │       └── SampleMockDataStore.java   # In-memory CRUD store (for mock)
    └── communication/            # Communication service integration
        ├── controller/
        │   └── CommunicationController.java
        ├── service/
        │   ├── CommunicationService.java
        │   └── impl/
        │       └── CommunicationServiceImpl.java
        └── feign/
            └── CommunicationFeignClient.java
```

## Key Architecture

### Auth Provider Pattern (core/ module - internal logic)
- `AuthProvider` - Generic interface for auth providers
- `AuthProviderFactory` - Creates provider based on config (`auth.provider.type`)
- `CognitoAuthProvider` - Cognito implementation with all OAuth2 operations
- `AuthService` - Orchestrates auth flow, controller delegates to this

### Layered Architecture Convention (ALL modules)

**MANDATORY Convention: Controller → Service (interface) → ServiceImpl**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────┐     ┌───────────────────┐
│   Controller    │────▶│     Service     │────▶│    ServiceImpl      │────▶│   Dependencies    │
│  (REST API)     │     │   (interface)   │     │   (@Service)        │     │ (Feign/Repo/etc)  │
│  NO LOGIC HERE  │     │   (contract)    │     │  ALL LOGIC HERE     │     │                   │
└─────────────────┘     └─────────────────┘     └─────────────────────┘     └───────────────────┘
```

**Core Principle:**
- **Controllers are THIN** - They only handle HTTP concerns (request/response mapping, status codes)
- **ALL business logic lives in Service layer** - Validation, transformation, orchestration
- **Services ALWAYS have interface + impl** - No exceptions

**What ServiceImpl calls depends on the use case:**
- External microservice → FeignClient
- Database → Repository
- Another domain → Another Service
- Multiple of the above → Orchestrate in ServiceImpl

**Why this layered pattern?**
- **Separation of concerns**: Controller handles HTTP, Service handles ALL logic
- **Testability**: Service interface can be mocked in controller tests
- **Extensibility**: ServiceImpl can add caching, validation, transformation
- **Consistency**: Team standard across all services
- **Future hooks**: 
  - Authorization via `@PreAuthorize` on service methods (Phase 6)
  - Audit logging via AOP on service layer (Phase 8)

### Layered Structure
- `common/` - Cross-cutting infrastructure (security, exceptions, responses, Feign config)
- `core/` - Framework module (auth, user management, RBAC) - **internal application logic**
- `domain/` - Business domains (service integrations) - **external microservice proxies**

## Build Commands

```bash
# Compile
docker-compose exec backend ./gradlew compileJava

# Test
docker-compose exec backend ./gradlew test

# Full build
docker-compose exec backend ./gradlew build

# Run migrations
docker-compose exec backend ./gradlew flywayMigrate
```

## Conventions

1. **Plain JPA Entities**: No DDD base classes (no `extends Entity`, `extends AggregateRoot`)
2. **DTOs as Records**: Use Java records for DTOs when possible
3. **Layered Architecture**: Controller → Service (interface) → ServiceImpl (ALL logic here)
4. **Controllers are THIN**: No business logic in controllers - they only map HTTP requests to service calls
5. **AuthProvider Abstraction**: Controller → AuthService → AuthProvider (never direct Cognito calls)
6. **LG Common Libraries**: Use provided exception handling, correlation ID, caching
7. **Flyway Migrations**: Located at `src/main/resources/flyway/common/` (environment-specific in `flyway/env/{local,dev,qa,stg,prd}/`)
8. **API Versioning**: All controllers use `/v1` prefix (e.g., `@RequestMapping("/v1/auth")`)

## API Context Path

All endpoints under: `/us/common/admin/`

| Path | Purpose | Auth |
|------|---------|------|
| `/v1/auth/*` | Authentication | Public |
| `/v1/admin/*` | Admin management | Protected |
| `/v1/{service}/*` | Service proxy (e.g., `/v1/sample/*`, `/v1/communication/*`) | Protected |
| `/mock/{service}/*` | Internal mock endpoints (e.g., `/mock/sample/*`) | Public (internal only) |
| `/actuator/*` | Health checks | Public |

## Security Configuration

The `SecurityConfig` uses a default-deny approach:

```java
.authorizeHttpRequests(auth -> auth
    .requestMatchers("/actuator/**").permitAll()
    .requestMatchers("/v1/auth/**").permitAll()
    .requestMatchers("/openapi/**").permitAll()
    .requestMatchers("/mock/**").permitAll()
    .anyRequest().authenticated()  // All other requests require authentication
)
```

**No need to add each new service** - any `/v1/{service}/*` endpoint is automatically protected.

## Adding a New Service Integration

### Step 1: Add configuration to `application.yml`

```yaml
microservice:
  host: http://microservice.lgcomus-dev.lge.com
  sample: ${microservice.host}/us/common/admin/mock/sample  # Points to mock for local dev
  communication: ${microservice.host}/us/common/communication/v1
  order: ${microservice.host}/us/common/order/v1  # NEW SERVICE
```

### Step 2: Create Feign Client

Create `domain/order/feign/OrderFeignClient.java`:

```java
@FeignClient(
    name = "OrderFeignClient",
    url = "${microservice.order}",
    configuration = AuthorizationFeignInterceptor.class
)
public interface OrderFeignClient {
    
    @GetMapping("/carts")
    PageResponse<CartDto> getCarts(@RequestParam int page, @RequestParam int size);
    
    @GetMapping("/carts/{id}")
    DataResponse<CartDto> getCart(@PathVariable("id") Long id);
    
    @PostMapping("/carts")
    DataResponse<CartDto> createCart(@RequestBody CreateCartRequest request);
}
```

### Step 3: Create Service Interface

Create `domain/order/service/OrderService.java`:

```java
public interface OrderService {
    PageResponse<CartDto> getCarts(int page, int size);
    DataResponse<CartDto> getCart(Long id);
    DataResponse<CartDto> createCart(CreateCartRequest request);
}
```

### Step 4: Create Service Implementation

Create `domain/order/service/impl/OrderServiceImpl.java`:

```java
@Slf4j
@RequiredArgsConstructor
@Service
public class OrderServiceImpl implements OrderService {
    
    private final OrderFeignClient orderFeignClient;
    
    @Override
    public PageResponse<CartDto> getCarts(int page, int size) {
        return orderFeignClient.getCarts(page, size);
    }
    
    @Override
    public DataResponse<CartDto> getCart(Long id) {
        return orderFeignClient.getCart(id);
    }
    
    @Override
    public DataResponse<CartDto> createCart(CreateCartRequest request) {
        return orderFeignClient.createCart(request);
    }
}
```

### Step 5: Create Controller

Create `domain/order/controller/OrderController.java`:

```java
@RestController
@RequestMapping("/v1/order")
@RequiredArgsConstructor
@Tag(name = "Order Service", description = "Proxy to Order microservice")
public class OrderController {
    
    private final OrderService orderService;
    
    @Operation(summary = "List carts")
    @GetMapping("/carts")
    public ResponseEntity<PageResponse<CartDto>> getCarts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(orderService.getCarts(page, size));
    }
    
    @Operation(summary = "Get cart by ID")
    @GetMapping("/carts/{id}")
    public ResponseEntity<DataResponse<CartDto>> getCart(@PathVariable Long id) {
        return ResponseEntity.ok(orderService.getCart(id));
    }
    
    @Operation(summary = "Create cart")
    @PostMapping("/carts")
    public ResponseEntity<DataResponse<CartDto>> createCart(@RequestBody CreateCartRequest request) {
        return ResponseEntity.ok(orderService.createCart(request));
    }
}
```

### Step 6: Add DTOs

Create `domain/order/dto/` with necessary DTOs:
- `CartDto.java`
- `CreateCartRequest.java`
- etc.

### Step 7 (Phase 6): Add permissions via `@PreAuthorize` on service methods

```java
@Override
@PreAuthorize("hasPermission(null, 'order:read')")
public PageResponse<CartDto> getCarts(int page, int size) {
    return orderFeignClient.getCarts(page, size);
}
```

## Directory Structure Template

When adding a new domain service integration:

```
domain/{service-name}/
├── controller/
│   └── {ServiceName}Controller.java    # REST API endpoints
├── service/
│   ├── {ServiceName}Service.java       # Service interface
│   └── impl/
│       └── {ServiceName}ServiceImpl.java  # @Service implementation
├── feign/
│   └── {ServiceName}FeignClient.java   # Feign client interface
└── dto/
    └── ...                              # Request/Response DTOs
```
