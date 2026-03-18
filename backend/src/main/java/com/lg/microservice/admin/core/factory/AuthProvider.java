package com.lg.microservice.admin.core.factory;

import com.lg.microservice.admin.core.model.dto.TokenResponse;
import com.lg.microservice.admin.core.model.entity.User;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

public interface AuthProvider {

    String getProviderType();

    String getProviderMode();

    String getLoginUrl(String state, String codeChallenge, String redirectUri);

    String getLogoutUrl(String redirectUri);

    String getChangePasswordUrl(String redirectUri);

    TokenResponse exchangeCodeForTokens(String code, String codeVerifier, String redirectUri);

    TokenResponse refreshAccessToken(String refreshToken);

    void revokeToken(String token);

    JwtDecoder createJwtDecoder();

    String getRedirectUri();

    String getPostLogoutRedirectUri();

    default String getIssuer() {
        throw new UnsupportedOperationException("getIssuer() not implemented for " + getProviderType());
    }

    default User getUser(Jwt jwt) {
        throw new UnsupportedOperationException("getUser() not implemented for " + getProviderType());
    }

    default User syncUserFromCallback(TokenResponse tokenResponse) {
        throw new UnsupportedOperationException("syncUserFromCallback() not implemented for " + getProviderType());
    }
}
