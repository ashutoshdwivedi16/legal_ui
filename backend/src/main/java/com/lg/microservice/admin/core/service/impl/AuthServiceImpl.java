package com.lg.microservice.admin.core.service.impl;

import com.lg.microservice.admin.core.factory.AuthProvider;
import com.lg.microservice.admin.core.factory.AuthProviderFactory;
import com.lg.microservice.admin.core.factory.AuthProviderProperties;
import com.lg.microservice.admin.core.model.dto.AuthCallbackResult;
import com.lg.microservice.admin.core.model.dto.AuthLogoutResult;
import com.lg.microservice.admin.core.model.dto.AuthRefreshResult;
import com.lg.microservice.admin.core.model.dto.ChangePasswordUrlResponse;
import com.lg.microservice.admin.core.model.dto.LoginUrlResponse;
import com.lg.microservice.admin.core.model.dto.TokenResponse;
import com.lg.microservice.admin.core.service.AuthService;
import com.lg.microservice.admin.core.service.AuthStateStore;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthServiceImpl implements AuthService {

    private static final String REFRESH_TOKEN_COOKIE = "refresh_token";
    private static final Duration REFRESH_TOKEN_MAX_AGE = Duration.ofDays(30);

    private final AuthProviderFactory authProviderFactory;
    private final AuthProviderProperties authProviderProperties;
    private final AuthStateStore authStateStore;

    @Override
    public LoginUrlResponse generateLoginUrl() {
        String state = UUID.randomUUID().toString();
        String codeVerifier = authStateStore.generateAndStoreCodeVerifier(state);
        String codeChallenge = authStateStore.computeCodeChallenge(codeVerifier);

        AuthProvider authProvider = getAuthProvider();
        String redirectUri = authProvider.getRedirectUri();
        String loginUrl = authProvider.getLoginUrl(state, codeChallenge, redirectUri);

        return new LoginUrlResponse(loginUrl, state);
    }

    @Override
    public AuthCallbackResult handleCallback(String code, String state) {
        try {
            String codeVerifier = authStateStore.retrieveAndRemoveCodeVerifier(state);
            if (codeVerifier == null) {
                return AuthCallbackResult.builder()
                        .success(false)
                        .redirectLocation("/login?error=invalid_state")
                        .build();
            }

            AuthProvider authProvider = getAuthProvider();
            String redirectUri = authProvider.getRedirectUri();
            TokenResponse tokenResponse = authProvider.exchangeCodeForTokens(code, codeVerifier, redirectUri);

            authProvider.syncUserFromCallback(tokenResponse);

            return AuthCallbackResult.builder()
                    .success(true)
                    .redirectLocation("/")
                    .refreshTokenCookie(createRefreshTokenCookie(tokenResponse.getRefreshToken()))
                    .build();
        } catch (Exception e) {
            log.error("OAuth callback failed", e);
            return AuthCallbackResult.builder()
                    .success(false)
                    .redirectLocation("/login?error=callback_failed")
                    .build();
        }
    }

    @Override
    public AuthRefreshResult refreshToken(HttpServletRequest request) {
        String refreshToken = extractTokenFromCookies(request, REFRESH_TOKEN_COOKIE);
        if (refreshToken == null) {
            return AuthRefreshResult.builder()
                    .success(false)
                    .build();
        }

        try {
            AuthProvider authProvider = getAuthProvider();
            TokenResponse tokenResponse = authProvider.refreshAccessToken(refreshToken);

            return AuthRefreshResult.builder()
                    .success(true)
                    .accessToken(tokenResponse.getAccessToken())
                    .build();
        } catch (Exception e) {
            log.error("Token refresh failed", e);
            return AuthRefreshResult.builder()
                    .success(false)
                    .build();
        }
    }

    @Override
    public AuthLogoutResult logout(HttpServletRequest request) {
        String refreshToken = extractTokenFromCookies(request, REFRESH_TOKEN_COOKIE);
        if (refreshToken != null) {
            try {
                AuthProvider authProvider = getAuthProvider();
                authProvider.revokeToken(refreshToken);
            } catch (Exception e) {
                log.warn("Failed to revoke token during logout", e);
            }
        }

        String logoutUrl = getAuthProvider().getLogoutUrl(
                getAuthProvider().getPostLogoutRedirectUri()
        );

        return AuthLogoutResult.builder()
                .logoutUrl(logoutUrl)
                .clearRefreshTokenCookie(createClearCookie(REFRESH_TOKEN_COOKIE))
                .build();
    }

    @Override
    public ChangePasswordUrlResponse generateChangePasswordUrl() {
        AuthProvider authProvider = getAuthProvider();
        String redirectUri = authProvider.getRedirectUri();
        String changePasswordUrl = authProvider.getChangePasswordUrl(redirectUri);
        return new ChangePasswordUrlResponse(changePasswordUrl);
    }

    private ResponseCookie createRefreshTokenCookie(String token) {
        return ResponseCookie.from(REFRESH_TOKEN_COOKIE, token)
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .maxAge(REFRESH_TOKEN_MAX_AGE)
                .path("/")
                .build();
    }

    private ResponseCookie createClearCookie(String name) {
        return ResponseCookie.from(name, "")
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .maxAge(0)
                .path("/")
                .build();
    }

    private String extractTokenFromCookies(HttpServletRequest request, String cookieName) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (cookieName.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private AuthProvider getAuthProvider() {
        return authProviderFactory.getAuthProvider(
                authProviderProperties.getType(),
                authProviderProperties.getMode()
        );
    }
}
