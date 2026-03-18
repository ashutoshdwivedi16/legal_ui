# Magento Admin ↔ Lg Admin Iframe Integration

**Version:** 2.0 | **Date:** 2025-02-16 | **Status:** Draft

---

## 1. Overview

**Problem:** Privileged Magento admin users need access to Lg Admin pages without leaving Magento and without signing into Cognito separately.

**Solution:** Magento embeds Lg Admin pages in iframes. Magento generates JWTs locally using RSA keys; Lg Admin validates with the corresponding public key. The embedded pages render frameless (no sidebar/header).

**Two login paths coexist (neither changes the other):**

| Path | User | Flow |
|------|------|------|
| **Direct** | Regular admin user | Cognito login → full app with sidebar/header |
| **Embedded** | Magento admin user | Magento admin → Lg/Admin menu (Users / Roles) → iframe loads page frameless |

---

## 2. Auth Architecture (Unified)

Both regular and embed users authenticate via `Authorization: Bearer` headers. No API calls use cookies for authentication.

### 2.1 Regular User Flow (Changed)

Previously, the access_token was stored in an HttpOnly cookie and a proxy (Vite/nginx) converted it to a Bearer header. This is replaced with: **access_token in JS memory, refresh_token stays in HttpOnly cookie.**

```
LOGIN:
  Cognito → callback → backend exchanges code for tokens
  → Sets ONLY refresh_token as HttpOnly cookie (access_token NOT in cookie)
  → 302 redirect to /

ON INITIAL LOAD (no token in memory):
  AuthProvider calls POST /auth/refresh
  → Browser sends refresh_token cookie automatically
  → Backend returns { accessToken: "eyJ..." } in JSON body
  → Frontend stores in Zustand memory
  → All API calls use Authorization: Bearer {accessToken}
  (SPA navigations skip refresh — token already in Zustand)

ON 401:
  axios interceptor calls POST /auth/refresh → new accessToken → retry
```

**What this eliminates:**
- Vite proxy token injection (`vite.config.ts` extractAccessToken — remove)
- nginx token injection (`nginx.conf` cookie_access_token — remove)
- access_token cookie entirely

**What stays:**
- refresh_token HttpOnly cookie (survives page refresh, XSS-proof)
- Stateless backend (just forwards refresh_token to Cognito)

### 2.2 Embed User Flow

```
MAGENTO:
  1. Admin clicks "LG Admin > Users" (or "Roles") menu item
  2. Magento controller generates JWT signed with RSA private key
     (claims: email, source: "magento", iss: "lg-admin-magento")
  3. Renders <iframe src="https://lg-admin.com/user/users?embed&token=eyJ...">

INSIDE IFRAME:
  1. Frontend reads ?embed and ?token= from URL on boot
  2. Sets module-level embed flag + accessToken in Zustand, strips token from URL
  3. Root route renders FramelessLayout (no sidebar/header)
  4. All API calls use Authorization: Bearer {token} (same as regular)
  5. On 401 → postMessage TOKEN_REFRESH to parent
  6. Parent generates new JWT locally → posts TOKEN_REFRESHED back
```

### 2.3 Why Both Flows Share the Same API Layer

```
Regular:  /auth/refresh   → accessToken → Zustand → Bearer header → API
Embed:    URL ?token=     → accessToken → Zustand → Bearer header → API
                                                      ↑
                                                identical from here
```

No dual-mode axios, no separate auth stores, no conditional logic in API calls. The only difference is how the token enters memory and how it refreshes.

---

## 3. Prerequisite: Provider-Agnostic Fixes ✅ COMPLETED

These fixes were completed in Phase 1 and further refined in Phase 3/4.

### 3.1 AppJwtConverter (formerly AppJwtAuthenticationConverter)

**File:** `common/security/AppJwtConverter.java`

Renamed and simplified. Now delegates to `AuthConfig` for provider resolution:

```java
public class AppJwtConverter implements Converter<Jwt, AbstractAuthenticationToken> {
    private final AuthConfig authConfig;
    private final UserService userService;

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        AuthProvider provider = authConfig.getProvider(jwt);
        User user = provider.getUser(jwt);  // Finds user, throws 403 if not found
        Collection<GrantedAuthority> authorities = userService.getUserAuthorities(user);
        String displayName = buildDisplayName(user);
        return new JwtAuthenticationToken(jwt, authorities, displayName);
    }
}
```

**Key changes:**
- JWT group claims ignored — authorization 100% from DB
- `getUser()` instead of `getOrCreateUser()` — no auto-creation on API calls
- `getName()` returns user's full name (firstName + lastName), not email

### 3.2 AuthConfig (NEW)

**File:** `common/security/AuthConfig.java`

Central registry for issuer → provider/decoder mapping:

```java
@Component
public class AuthConfig {
    private final Map<String, AuthProvider> issuerProviderMap;
    private final Map<String, JwtDecoder> issuerDecoderMap;

    public AuthProvider getProvider(Jwt jwt);       // From decoded token
    public JwtDecoder getDecoder(String issuer);    // From issuer string
    public String peekIssuer(String token);         // Base64 decode, no crypto
}
```

### 3.3 Files Changed (Final State)

| File | Status |
|------|--------|
| `AuthConfig.java` | **NEW** — Central issuer registry |
| `AppJwtDecoder.java` | **Renamed** from CompositeJwtDecoder, uses AuthConfig |
| `AppJwtConverter.java` | **Renamed** from AppJwtAuthenticationConverter, uses AuthConfig |
| `AuthProvider.java` | `getUser(jwt)` instead of `getOrCreateUser(jwt)` |
| `CognitoAuthProvider.java` | `getUser()` finds by externalId, throws 403 |
| `MagentoAuthProvider.java` | `getUser()` finds by email, throws 403 |
| `UserService.java` | Added `getUserByExternalId()`, `getUserByEmail()` |

---

## 4. Auth Changes: Regular Flow

### 4.1 Backend: Callback (Modified)

**File:** `AuthController.java` — `handleCallback()` sets **only refresh_token cookie**, not access_token:

```java
return ResponseEntity.status(302)
    .header(HttpHeaders.LOCATION, result.getRedirectLocation())
    .header(HttpHeaders.SET_COOKIE, result.getRefreshTokenCookie().toString())
    // access_token cookie REMOVED
    .build();
```

### 4.2 Backend: Refresh (Modified)

**File:** `AuthController.java` — `refreshToken()` returns access_token in **JSON body** instead of cookie:

```java
@PostMapping("/refresh")
public ResponseEntity<DataResponse<TokenRefreshResponse>> refreshToken(HttpServletRequest request) {
    AuthRefreshResult result = authService.refreshToken(request);
    if (!result.isSuccess()) {
        return ResponseEntity.status(401).build();
    }
    return ResponseEntity.ok(DataResponse.of(
        new TokenRefreshResponse(result.getAccessToken())
    ));
}
```

New DTO: `TokenRefreshResponse(String accessToken)`

### 4.3 Frontend: authStore (Modified)

**File:** `authStore.ts` — add `accessToken` field, modify `checkAuth`:

```typescript
export const useAuthStore = create<AuthStore>((set, get) => ({
  accessToken: null,      // NEW: token in memory
  isAuthenticated: false,
  user: null,
  isLoading: true,

  checkAuth: async () => {
    set({ isLoading: true })
    try {
      // Only call /auth/refresh if no token in memory (browser refresh, first load)
      // SPA navigations already have token in Zustand — skip the refresh call
      if (!get().accessToken) {
        const tokenRes = await axios.post('/auth/refresh')
        const accessToken = tokenRes.data.data.accessToken
        set({ accessToken })
      }

      // Get user info (Bearer header auto-injected by interceptor)
      const userRes = await apiClient.get('/auth/me')
      set({ isAuthenticated: true, user: userRes.data.data, isLoading: false })
    } catch {
      set({ isAuthenticated: false, user: null, accessToken: null, isLoading: false })
    }
  },
}))
```

### 4.4 Frontend: axios (Modified)

**File:** `axios.ts` — add request interceptor for Bearer header:

```typescript
const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // needed for /auth/refresh to send refresh_token cookie
})

// Inject Bearer header from memory
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401: refresh or request from parent
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.startsWith('/auth/')) return Promise.reject(error)
      originalRequest._retry = true
      try {
        if (isEmbedMode()) {
          const newToken = await requestTokenFromParent()
          useAuthStore.getState().setAccessToken(newToken)
        } else {
          const res = await apiClient.post('/auth/refresh')
          useAuthStore.getState().setAccessToken(res.data.data.accessToken)
        }
        return apiClient(originalRequest)
      } catch {
        if (!isEmbedMode()) window.location.href = '/login'
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)
```

### 4.5 Remove Proxy Token Injection

- **vite.config.ts**: Remove `extractAccessToken()` function and `proxyReq` handler. Keep simple proxy.
- **nginx.conf**: Remove `set $bearer` / `proxy_set_header Authorization` lines. Keep `proxy_pass`.

---

## 5. Embed Token Architecture

Magento is the auth provider for the embed flow — same trust model as Cognito for regular flow. Lg Admin never generates embed tokens.

| Concern | Regular Flow | Embed Flow |
|---------|-------------|------------|
| Auth Provider | Cognito | Magento |
| Token Generator | Cognito | Magento |
| Signing | Cognito RSA private key | Magento RSA private key |
| Lg Admin Validation | Cognito JWKS (public key) | Magento RSA public key (configured) |

### 5.1 JWT (Generated by Magento)

Magento signs with RSA-256 private key. Lg Admin validates with the corresponding public key.

**Claims:**

| Claim | Example | Purpose |
|-------|---------|---------|
| `sub` | `admin@lg.com` | Subject (email) |
| `email` | `admin@lg.com` | User lookup in Lg Admin DB |
| `iss` | `lg-admin-magento` | Issuer — distinguishes from Cognito tokens |
| `source` | `magento` | Explicit source marker |
| `exp` | +1 hour | Expiry |

Roles/permissions come from Lg Admin DB (loaded by `AppJwtConverter` via `userService.getUserAuthorities()`), not from JWT claims. User **must exist** in Lg Admin's `users` table. If user is not found, `getUser()` throws 403 — no auto-creation on API calls.

### 5.2 AppJwtDecoder (Multi-Provider Decoder)

**File:** `common/security/AppJwtDecoder.java`

Routes to the correct decoder via `AuthConfig`:

```java
@Component
public class AppJwtDecoder implements JwtDecoder {
    private final AuthConfig authConfig;

    @Override
    public Jwt decode(String token) throws JwtException {
        String issuer = authConfig.peekIssuer(token);  // Base64-decode, no crypto
        JwtDecoder decoder = authConfig.getDecoder(issuer);
        return decoder.decode(token);
    }
}
```

`peekIssuer()` is a cheap string operation — no signature verification. The `iss` is only a routing hint; actual trust comes from the decoder's signature validation. A forged `iss` just fails at the signature check.

**AuthConfig** holds the issuer → decoder map:
- Cognito issuer → Cognito JWKS decoder
- `lg-admin-magento` → Magento RSA public key decoder

### 5.3 Full Auth Flow

```
Request with Bearer token
    ↓
SecurityConfig (injects AppJwtDecoder + AppJwtConverter)
    ↓
AppJwtDecoder.decode(token)
    ├─ authConfig.peekIssuer(token) → "lg-admin-magento" or Cognito URL
    └─ authConfig.getDecoder(issuer) → validates signature, returns Jwt
    ↓
AppJwtConverter.convert(jwt)
    ├─ authConfig.getProvider(jwt) → MagentoAuthProvider or CognitoAuthProvider
    ├─ provider.getUser(jwt) → finds user in DB (throws 403 if not found)
    └─ userService.getUserAuthorities(user) → loads roles/permissions from DB
    ↓
JwtAuthenticationToken (with authorities, name = user's full name)
```

---

## 6. Magento Module: Lg/Admin

### 6.1 Module Structure

```
m247/src/app/code/Lg/Admin/
├── registration.php
├── etc/
│   ├── module.xml                    # Depends on Magento_Backend
│   ├── acl.xml                       # Lg_Admin::root, Lg_Admin::embed
│   ├── config.xml                    # Default config values (lg-admin URL)
│   └── adminhtml/
│       ├── routes.xml                # frontName: lg_admin
│       ├── menu.xml                  # Two entries: "LG Admin > Users", "LG Admin > Roles"
│       ├── system.xml                # Admin config: lg-admin URL, RSA key generation + storage
│       └── csp_whitelist.xml         # frame-src + connect-src for lg-admin domain
├── Controller/Adminhtml/Embed/
│   ├── Index.php                     # Generates JWT, renders iframe page
│   └── RefreshToken.php              # AJAX: generates fresh JWT for postMessage refresh
├── Controller/Adminhtml/Config/
│   └── GenerateKeys.php              # AJAX: generates RSA key pair, saves to config
├── Model/
│   └── JwtGenerator.php              # RSA-256 JWT signing (reads private key from DB config)
├── Block/Adminhtml/
│   ├── EmbedPage.php                 # Exposes iframeUrl, embedToken, allowedOrigin to template
│   └── System/Config/
│       └── GenerateKeysButton.php    # Renders "Generate Keys" button in system config
└── view/adminhtml/
    ├── layout/lg_admin_embed_index.xml
    ├── templates/embed.phtml         # Iframe + JS init
    ├── web/js/embed-bridge.js        # Listens for TOKEN_REFRESH, posts TOKEN_REFRESHED
    ├── web/css/embed.css
    └── requirejs-config.js
```

### 6.2 Key Details

**system.xml — RSA Key Management:**

Admin config at Stores → Configuration → LG Admin:

| Field | Type | Description |
|-------|------|-------------|
| Lg Admin URL | text | Frontend base URL (e.g. `https://lg-admin.example.com`) |
| Generate Keys | button | Generates RSA-2048 key pair via AJAX, saves to config |
| Private Key | textarea (readonly) | Auto-populated on generation. Used by `JwtGenerator` to sign JWTs |
| Public Key | textarea (readonly) | Auto-populated on generation. **Copy this into Lg Admin's `MAGENTO_JWT_PUBLIC_KEY` env var** |

`GenerateKeys.php` controller: generates RSA-2048 key pair → saves both to `core_config_data` (encrypted) → returns JSON with both keys. `GenerateKeysButton.php` block renders the button with AJAX handler.

**menu.xml:** Two menu entries under "LG Admin" parent:
- "Users" → `lg_admin/embed/index/page/users` → embeds `/user/users?embed`
- "Roles" → `lg_admin/embed/index/page/roles` → embeds `/user/roles?embed`

**Controller/Index.php:** Reads `?page=` param → maps to Lg Admin path → calls `JwtGenerator` with current admin's email → passes token + iframe URL to block.

**Model/JwtGenerator.php:** Reads RSA private key from DB config → builds JWT with claims (sub, email, iss, source, exp) → signs with RS256 → returns token string. No HTTP calls — token generation is local.

**Template (embed.phtml):** Token in iframe src URL:
```html
<iframe id="lg-embed-iframe"
        src="<?= $block->escapeUrl($block->getIframeUrl()) ?>?embed&token=<?= $block->escapeUrl($block->getEmbedToken()) ?>"
        style="width:100%; height:calc(100vh - 200px); border:none;"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups">
</iframe>
```

**RefreshToken.php:** AJAX endpoint for postMessage refresh. Calls `JwtGenerator` for a fresh JWT — no external HTTP calls.

**embed-bridge.js:** Listens for `TOKEN_REFRESH` from iframe → AJAX call to RefreshToken controller → posts `TOKEN_REFRESHED { token }` back. Validates `event.origin` on all messages.

---

## 7. Lg Admin Frontend: Embed Support

### 7.1 Embed Detection + Token from URL

`?embed` query param = embed mode. Detected once on app boot via module-level flag — not Zustand state.

```typescript
// shared/lib/embed.ts
let _embed = false
export const initEmbedMode = () => {
  const params = new URLSearchParams(window.location.search)
  _embed = params.has('embed')

  const token = params.get('token')
  if (_embed && token) {
    useAuthStore.getState().setAccessToken(token)
    window.history.replaceState({}, '', window.location.pathname + '?embed')
  }
}
export const isEmbedMode = () => _embed
```

Called once before React renders. No Zustand `embedMode` field. No duplicate routes.

### 7.2 postMessage (Embed Refresh Only)

| Direction | Type | Payload | When |
|-----------|------|---------|------|
| Iframe → Parent | `TOKEN_REFRESH` | `{}` | API returned 401 |
| Parent → Iframe | `TOKEN_REFRESHED` | `{ token: string }` | Parent generated new JWT |

Both sides **must** validate `event.origin`. Never use `'*'` as targetOrigin.

### 7.3 FramelessLayout + Route Selection

**New:** `FramelessLayout.tsx` — semantic layout for embed mode. Just `<Outlet />` with padding, no sidebar/header.

**Modify:** `App.tsx` — pick layout at the root route level:

```tsx
initEmbedMode() // called once on app boot

<Route element={isEmbedMode() ? <FramelessLayout /> : <MainLayout />}>
  {/* exact same routes — no duplication */}
</Route>
```

`MainLayout` has zero embed awareness. `FramelessLayout` is a clean, separate component. Layout selection happens once at the root — no conditional logic inside either layout.

### 7.4 Nginx

Remove token injection (`set $bearer` / `proxy_set_header Authorization` lines). Keep simple `proxy_pass` and `try_files`.

---

## 8. Security

| Threat | Mitigation |
|--------|-----------|
| Forged embed token | RSA-256 asymmetric signing. Magento holds private key; Lg Admin validates with public key only |
| XSS token theft | Access token in memory only. Refresh token in HttpOnly cookie |
| postMessage spoofing | Strict origin validation both sides |
| Clickjacking | `SameSite=Lax` on refresh_token cookie; embed flow uses no cookies |
| Token in URL leakage | Stripped immediately via `history.replaceState`; only in iframe src (not address bar) |
| Iframe top-navigation | `sandbox` omits `allow-top-navigation` |
| Privilege escalation | Roles/permissions loaded from Lg Admin DB, not from JWT claims |

**Not in scope:** User provisioning sync, two-way role mapping, storefront embedding.

---

## 9. Configuration

### Lg Admin Backend (new)

| Variable | Purpose |
|----------|---------|
| `MAGENTO_JWT_PUBLIC_KEY` | RSA public key (PEM) for validating Magento-issued JWTs |


### Lg Admin Frontend (new)

| Variable | Purpose |
|----------|---------|
| `VITE_EMBED_ALLOWED_ORIGIN` | postMessage origin validation |

### Magento (new — stored in `core_config_data`, encrypted)

| Config Path | Purpose |
|-------------|---------|
| `lg_admin/general/lg_admin_url` | Lg Admin frontend base URL |
| `lg_admin/general/rsa_private_key` | RSA private key (PEM) — generated via admin button |
| `lg_admin/general/rsa_public_key` | RSA public key (PEM) — copy to Lg Admin's `MAGENTO_JWT_PUBLIC_KEY` |

---

## 10. File Inventory

### New — Magento (`m247/src/app/code/Lg/Admin/`)

19 files: `registration.php`, `etc/module.xml`, `etc/acl.xml`, `etc/config.xml`, `etc/adminhtml/routes.xml`, `etc/adminhtml/menu.xml`, `etc/adminhtml/system.xml`, `etc/adminhtml/csp_whitelist.xml`, `Controller/Adminhtml/Embed/Index.php`, `Controller/Adminhtml/Embed/RefreshToken.php`, `Controller/Adminhtml/Config/GenerateKeys.php`, `Model/JwtGenerator.php`, `Block/Adminhtml/EmbedPage.php`, `Block/Adminhtml/System/Config/GenerateKeysButton.php`, `view/adminhtml/layout/lg_admin_embed_index.xml`, `view/adminhtml/templates/embed.phtml`, `view/adminhtml/web/js/embed-bridge.js`, `view/adminhtml/web/css/embed.css`, `view/adminhtml/requirejs-config.js`

### New — Lg Admin Backend

| File | Purpose |
|------|---------|
| `AuthConfig.java` | Central issuer → provider/decoder registry |
| `AppJwtDecoder.java` | Multi-provider JWT decoder (uses AuthConfig) |
| `AppJwtConverter.java` | JWT → Authentication converter (uses AuthConfig) |
| `MagentoAuthProvider.java` | Magento auth provider (getUser by email) |
| `TokenRefreshResponse.java` | DTO for access token refresh response |

### Modified — Lg Admin Backend

| File | Change |
|------|--------|
| `AuthProvider.java` | `getUser(jwt)` replaces `getOrCreateUser(jwt)` |
| `CognitoAuthProvider.java` | `getUser()` finds by externalId, throws 403 |
| `UserService.java` | Added `getUserByExternalId()`, `getUserByEmail()` |
| `UserServiceImpl.java` | Uses `@Lazy AuthConfig` for provider resolution |
| `AuthController.java` | Returns accessToken in JSON body |
| `SecurityConfig.java` | Injects AppJwtDecoder + AppJwtConverter |
| `application.yml` | Added Magento JWT config |

### New — Lg Admin Frontend

| File | Purpose |
|------|---------|
| `FramelessLayout.tsx` | Minimal layout for embed mode |
| `embed.ts` | Embed mode detection + token extraction |

### Modified — Lg Admin Frontend

| File | Change |
|------|--------|
| `authStore.ts` | accessToken in memory, registerTokenHandlers pattern |
| `axios.ts` | Bearer header injection, 401 refresh/postMessage |
| `App.tsx` | Layout selection based on embed mode |
| `ProtectedRoute.tsx` | Shows AccessDenied in embed mode (no Cognito redirect) |
| `vite.config.ts` | Removed proxy token injection |

### Removed

| File | Reason |
|------|--------|
| `CompositeJwtDecoder.java` | Merged into AppJwtDecoder + AuthConfig |
| `AppJwtAuthenticationConverter.java` | Renamed to AppJwtConverter |
| Proxy token injection (Vite/nginx) | Token now in memory, Bearer header from frontend |
