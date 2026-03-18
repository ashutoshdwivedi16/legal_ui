# Magento Auth — Implementation Plan

**TRD:** [TRD.md](./TRD.md) | **Status:** All Phases Complete

---

## Phase 1: Provider-Agnostic Fixes + New Auth Flow

Fix Cognito coupling and switch to Bearer-from-memory auth. No embed features — regular flow only.

### 1A. Provider-Agnostic Fixes (TRD §3)

No behavior change. Just decouple from Cognito-specific code.

- [x] **AppJwtAuthenticationConverter.java** — Remove `COGNITO_GROUPS_CLAIM` constant and its usage in `extractGroups()`. Keep only standard `GROUPS_CLAIM` ("groups"). Verify `userService.getUserAuthorities()` still provides RBAC (DB-backed, not JWT).
- [x] **AuthProvider.java** (interface) — Add `getRedirectUri()` and `getPostLogoutRedirectUri()` methods.
- [x] **CognitoAuthProvider.java** — Implement `getRedirectUri()` and `getPostLogoutRedirectUri()` returning values from `authProviderProperties.getCognito()`.
- [x] **AuthServiceImpl.java** — Replace 4 hardcoded `authProviderProperties.getCognito().getRedirectUri()` calls (lines 49, 67, 125, 138) with `getAuthProvider().getRedirectUri()` / `getAuthProvider().getPostLogoutRedirectUri()`.

**Verify:** Backend compiles. Existing login/logout/refresh flow works unchanged.

### 1B. Backend Auth Changes (TRD §4.1, §4.2)

Switch from access_token-in-cookie to access_token-in-response-body.

- [x] **TokenRefreshResponse.java** (new DTO) — `record TokenRefreshResponse(String accessToken)`. Place in `core/dto/` or alongside existing DTOs.
- [x] **AuthServiceImpl.java** — Update `refreshToken()` to return the access_token string in the result object (instead of only setting it as a cookie).
- [x] **AuthController.java — handleCallback()** — Remove `access_token` cookie from response. Keep only `refresh_token` HttpOnly cookie + 302 redirect.
- [x] **AuthController.java — refreshToken()** — Return `DataResponse<TokenRefreshResponse>` with access_token in JSON body. Keep `refresh_token` cookie renewal if applicable.

**Verify:** `POST /auth/refresh` returns `{ "data": { "accessToken": "eyJ..." } }`. Callback no longer sets access_token cookie. refresh_token cookie still set.

### 1C. Frontend Auth Changes (TRD §4.3, §4.4)

Switch from cookie-based auth to Bearer-from-memory.

- [x] **authStore.ts** — Add `accessToken: string | null` field and `setAccessToken` action. Update `checkAuth`: only call `POST /auth/refresh` if `!get().accessToken` (skip on SPA navigation). Store returned access_token in Zustand. Registers token handlers with axios via `registerTokenHandlers()` to avoid circular dependency.
- [x] **axios.ts** — Add request interceptor: inject `Authorization: Bearer {token}` via `registerTokenHandlers` callback pattern (avoids circular dep with authStore). Update 401 response interceptor: call `/auth/refresh`, store new token, retry original request. Skip retry for `/auth/*` URLs.
- [x] **AuthProvider.tsx** — Verified it calls `checkAuth` on mount. No changes needed.

**Verify:** Login flow works end-to-end. API calls include Bearer header. Page refresh triggers `/auth/refresh` → token in memory → subsequent API calls use Bearer. SPA navigation does NOT call `/auth/refresh` again.

### 1D. Remove Proxy Token Injection (TRD §4.5)

- [x] **vite.config.ts** — Remove `extractAccessToken()` function and `proxyReq` handler in dev proxy config. Keep simple `proxy_pass`-equivalent proxy.
- [x] **nginx.conf** — Remove `set $bearer` / `proxy_set_header Authorization` lines. Keep `proxy_pass` and `try_files`.

**Verify:** Dev server (Vite) and production (nginx) both work without token injection. All auth goes through Bearer header from frontend.

---

## Phase 2: Embed Features

Magento iframe integration. Depends on Phase 1 being complete and verified.

### 2A. Lg Admin Backend — Embed Token Validation (TRD §5)

Lg Admin validates Magento-issued JWTs. No new endpoints — just a second JWT decoder.

- [x] **MagentoJwtDecoder.java** (new) — Validates RSA-256 signature using configured public key. Checks `iss == "lg-admin-magento"` and expiry. Place in `common/security/`.
- [x] **CompositeJwtDecoder.java** (new) — Routes to correct decoder by peeking `iss` claim (Base64-decode payload, no crypto). If `iss == "lg-admin-magento"` → MagentoJwtDecoder, otherwise → Cognito decoder. No try-catch fallback. Place in `common/security/`.
- [x] **SecurityConfig.java** — Wraps Cognito decoder in CompositeJwtDecoder when `MAGENTO_JWT_PUBLIC_KEY` is configured. Backward compatible.
- [x] **application.yml** — Add `MAGENTO_JWT_PUBLIC_KEY` config property (RSA public key PEM string). Added `MagentoProperties` to `AuthProviderProperties.java`.

**Verify:** Backend compiles. Regular Cognito login still works (routing to Cognito decoder). A test JWT signed with a known RSA key and `iss: "lg-admin-magento"` is accepted. A forged token is rejected.

### 2B. Lg Admin Frontend — Embed Support (TRD §7)

Embed detection, frameless layout, postMessage token refresh.

- [x] **embed.ts** (new) — `initEmbedMode()` reads `?embed` and `?token=` from URL. Returns token string (no authStore import to avoid circular dep). Sets module-level `_embed` flag. Strips token from URL (keeps `?embed`). Place in `shared/lib/`.
- [x] **FramelessLayout.tsx** (new) — Semantic layout for embed mode. Just `<Outlet />` with padding. No sidebar, no header. Place alongside `MainLayout.tsx`.
- [x] **App.tsx** — Calls `initEmbedMode()` at module scope, stores returned token in authStore. Root route: `isEmbedMode() ? <FramelessLayout /> : <MainLayout />`. No duplicate routes.
- [x] **axios.ts** — Updated 401 interceptor: if `isEmbedMode()`, calls `requestTokenFromParent()` (postMessage with origin validation via `VITE_EMBED_ALLOWED_ORIGIN`) instead of `/auth/refresh`. Skips `/login` redirect in embed mode.
- [x] **AuthProvider.tsx** — No changes needed. `checkAuth()` already handles embed mode correctly: token is pre-loaded in Zustand, so it skips `/auth/refresh` and goes straight to `/auth/me`.

**Verify:** Loading `/user/users?embed&token=eyJ...` renders frameless (no sidebar/header). Token is stripped from URL. API calls include Bearer header. On 401, postMessage `TOKEN_REFRESH` is sent to parent.

### 2C. Magento Module — Lg/Admin (TRD §6)

Full Magento 2 module: admin config, RSA key generation, JWT signing, iframe embedding.

#### Config + Key Management

- [x] **registration.php** — Register `Lg_Admin` module.
- [x] **etc/module.xml** — Module declaration, depends on `Magento_Backend`.
- [x] **etc/config.xml** — Default config values for `lg_admin/general/*`.
- [x] **etc/acl.xml** — ACL resources: `Lg_Admin::root`, `Lg_Admin::embed`, `Lg_Admin::config`.
- [x] **etc/adminhtml/routes.xml** — Admin route with frontName `lg_admin`.
- [x] **etc/adminhtml/system.xml** — Config section: Lg Admin URL (text), Generate Keys (button), Private Key (readonly textarea), Public Key (readonly textarea).
- [x] **etc/adminhtml/csp_whitelist.xml** — Whitelist lg-admin domain for `frame-src` and `connect-src`.
- [x] **Block/Adminhtml/System/Config/GenerateKeysButton.php** — Custom `frontend_model` block. Renders "Generate Keys" button with AJAX handler.
- [x] **Controller/Adminhtml/Config/GenerateKeys.php** — AJAX controller: generates RSA-2048 key pair, saves both to `core_config_data` (encrypted), returns JSON.

**Verify:** Module installs (`bin/magento setup:upgrade`). Config page renders with URL field, Generate Keys button, and key textareas. Clicking Generate Keys populates both key fields.

#### JWT Generation + Embed Pages

- [x] **Model/JwtGenerator.php** — Manual RS256 JWT signing with openssl_sign(). Claims: sub, email, iss, source, exp, iat. Base64url encoding. No external JWT library.
- [x] **etc/adminhtml/menu.xml** — Two menu entries under "LG Admin" parent: "Users" and "Roles". Both route to embed controller with `page` param.
- [x] **Controller/Adminhtml/Embed/Index.php** — Reads `?page=` param, maps to Lg Admin path (`users` → `/user/users`, `roles` → `/user/roles`). Calls `JwtGenerator` with current admin's email. Passes token + iframe URL to block.
- [x] **Controller/Adminhtml/Embed/RefreshToken.php** — AJAX controller for postMessage refresh. Calls `JwtGenerator` for fresh JWT. Returns JSON `{ token: "eyJ..." }`.
- [x] **Block/Adminhtml/EmbedPage.php** — Exposes `getIframeUrl()`, `getEmbedToken()`, `getAllowedOrigin()`, `getRefreshTokenUrl()` to template.
- [x] **view/adminhtml/layout/lg_admin_embed_index.xml** — Layout XML for embed page.
- [x] **view/adminhtml/templates/embed.phtml** — Renders `<iframe>` with x-magento-init for embed-bridge. Sandbox: allow-scripts, allow-same-origin, allow-forms, allow-popups.
- [x] **view/adminhtml/web/js/embed-bridge.js** — RequireJS module. Listens for TOKEN_REFRESH, validates origin, AJAX refreshes with form_key CSRF, posts TOKEN_REFRESHED back.
- [x] **view/adminhtml/web/css/embed.css** — Iframe container styling (full width, calculated height).
- [x] **view/adminhtml/requirejs-config.js** — RequireJS mapping for embed-bridge module.

**Verify:** "LG Admin > Users" and "LG Admin > Roles" menu items appear in Magento admin. Clicking opens embed page with iframe. Iframe loads Lg Admin page frameless with valid JWT. Token refresh via postMessage works on 401.

---

## Phase 3: Auth Provider Refactoring

Simplify auth flow: no auto-creation on API calls, clean provider abstraction.

### 3A. AuthProvider Interface Changes

- [x] **AuthProvider.java** — Change `getOrCreateUser(Jwt jwt)` → `getUser(Jwt jwt)`. No user creation on API calls.
- [x] **CognitoAuthProvider.java** — Implement `getUser()`: find by `externalUserId` (JWT subject), throw 403 if not found. User creation happens only in `syncUserFromCallback()`.
- [x] **MagentoAuthProvider.java** — Implement `getUser()`: find by `email` (JWT claim), throw 403 if not found. No callback flow for Magento.
- [x] **UserService.java** — Add `getUserByExternalId(String externalUserId)` and `getUserByEmail(String email)`. Both throw 403 if not found.
- [x] **UserServiceImpl.java** — Implement `getUserByExternalId()` and `getUserByEmail()`. Removed `findOrCreateUser()` (placeholder email bug source).

**Verify:** API calls with valid JWT for non-existent user return 403. Cognito callback still creates/updates user. Existing users work unchanged.

### 3B. AppJwtConverter Simplification

- [x] **AppJwtConverter.java** (renamed from AppJwtAuthenticationConverter) — Simplified to use `authConfig.getProvider(jwt).getUser(jwt)`. No direct service calls, no Cognito-specific logic.
- [x] **buildDisplayName()** — Returns user's full name (firstName + lastName) instead of email for `JwtAuthenticationToken.getName()`.

**Verify:** `JwtAuthenticationToken.getName()` returns "John Smith" not "john@example.com".

---

## Phase 4: Auth Flow Consolidation

Consolidate duplicate issuer → provider/decoder logic into `AuthConfig`.

### 4A. AuthConfig (Central Registry)

- [x] **AuthConfig.java** (new) — Single source of truth for issuer → provider and issuer → decoder mappings. Constructor builds both maps from injected providers.
- [x] Methods: `getProvider(Jwt jwt)`, `getDecoder(String issuer)`, `peekIssuer(String token)`.
- [x] **AppJwtDecoder.java** (renamed from CompositeJwtDecoder) — Simplified to ~26 lines. Just calls `authConfig.peekIssuer()` → `authConfig.getDecoder()`.
- [x] **AppJwtConverter.java** — Uses `authConfig.getProvider(jwt)` instead of manual issuer checking.

**Verify:** Backend compiles. Both Cognito and Magento tokens still work.

### 4B. UserServiceImpl Cleanup

- [x] **UserServiceImpl.java** — Inject `AuthConfig` with `@Lazy` to break circular dependency (AuthConfig → providers → UserService → AuthConfig).
- [x] **getCurrentUser()** — Simplified: gets JWT from SecurityContext, uses `authConfig.getProvider(jwt).getUser(jwt)`.
- [x] **getAuthenticatedUser()** — New private helper for common pattern.
- [x] **getCurrentUserId()** — Now just `getAuthenticatedUser().getId()` (1 line).
- [x] Removed `Collectors.toList()` → `.toList()` cleanup.

**Verify:** `/auth/me` returns correct user info for both Cognito and Magento tokens.

### 4C. Embed AccessDenied Fix

- [x] **ProtectedRoute.tsx** — In embed mode, show `<AccessDenied />` instead of redirecting to Cognito login for unauthenticated users.

**Verify:** Loading `/user/users?embed` without valid token shows "Access Denied" page, not Cognito login redirect.
