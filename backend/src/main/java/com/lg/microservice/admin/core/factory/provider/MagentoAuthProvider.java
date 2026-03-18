package com.lg.microservice.admin.core.factory.provider;

import com.lg.microservice.admin.core.factory.AuthProvider;
import com.lg.microservice.admin.core.factory.AuthProviderProperties;
import com.lg.microservice.admin.core.model.dto.TokenResponse;
import com.lg.microservice.admin.core.model.entity.User;
import com.lg.microservice.admin.core.service.UserService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidationException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

import java.security.KeyFactory;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.List;

@Slf4j
@Component
@ConditionalOnProperty(name = "auth.provider.magento.public-key")
public class MagentoAuthProvider implements AuthProvider {

    private static final String MAGENTO_ISSUER = "lg-admin-magento";

    private final AuthProviderProperties properties;
    private final UserService userService;

    public MagentoAuthProvider(AuthProviderProperties properties, UserService userService) {
        this.properties = properties;
        this.userService = userService;
        log.info("MagentoAuthProvider initialized (issuer={})", MAGENTO_ISSUER);
    }

    @Override
    public String getProviderType() {
        return "magento";
    }

    @Override
    public String getProviderMode() {
        return "token";
    }

    @Override
    public String getIssuer() {
        return MAGENTO_ISSUER;
    }

    @Override
    public User getUser(Jwt jwt) {
        String email = jwt.getClaimAsString("email");
        return userService.getUserByEmail(email);
    }

    @Override
    public User syncUserFromCallback(TokenResponse tokenResponse) {
        throw new UnsupportedOperationException("Magento provider does not support OAuth2 callback");
    }

    @Override
    public JwtDecoder createJwtDecoder() {
        String publicKeyPem = properties.getMagento().getPublicKey();
        RSAPublicKey rsaPublicKey = parsePublicKey(publicKeyPem);
        JwtDecoder delegate = NimbusJwtDecoder.withPublicKey(rsaPublicKey).build();

        return token -> {
            Jwt jwt = delegate.decode(token);

            String issuer = jwt.getClaimAsString("iss");
            if (!MAGENTO_ISSUER.equals(issuer)) {
                log.warn("Magento JWT has unexpected issuer: {}", issuer);
                throw new JwtValidationException(
                        "Invalid issuer for Magento JWT: " + issuer,
                        List.of(new OAuth2Error("invalid_token",
                                "Expected issuer: " + MAGENTO_ISSUER, null))
                );
            }

            return jwt;
        };
    }

    @Override
    public String getLoginUrl(String state, String codeChallenge, String redirectUri) {
        throw new UnsupportedOperationException("Magento provider does not support OAuth2 login flow");
    }

    @Override
    public String getLogoutUrl(String redirectUri) {
        throw new UnsupportedOperationException("Magento provider does not support OAuth2 logout flow");
    }

    @Override
    public String getChangePasswordUrl(String redirectUri) {
        throw new UnsupportedOperationException("Magento provider does not support change password flow");
    }

    @Override
    public TokenResponse exchangeCodeForTokens(String code, String codeVerifier, String redirectUri) {
        throw new UnsupportedOperationException("Magento provider does not support OAuth2 token exchange");
    }

    @Override
    public TokenResponse refreshAccessToken(String refreshToken) {
        throw new UnsupportedOperationException("Magento provider does not support token refresh");
    }

    @Override
    public void revokeToken(String token) {
        throw new UnsupportedOperationException("Magento provider does not support token revocation");
    }

    @Override
    public String getRedirectUri() {
        throw new UnsupportedOperationException("Magento provider does not support redirect URIs");
    }

    @Override
    public String getPostLogoutRedirectUri() {
        throw new UnsupportedOperationException("Magento provider does not support post-logout redirect URIs");
    }

    private RSAPublicKey parsePublicKey(String pem) {
        try {
            String base64Key = pem
                    .replace("-----BEGIN PUBLIC KEY-----", "")
                    .replace("-----END PUBLIC KEY-----", "")
                    .replaceAll("\\s+", "");

            byte[] keyBytes = Base64.getDecoder().decode(base64Key);
            X509EncodedKeySpec keySpec = new X509EncodedKeySpec(keyBytes);
            KeyFactory keyFactory = KeyFactory.getInstance("RSA");
            return (RSAPublicKey) keyFactory.generatePublic(keySpec);
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to parse Magento RSA public key", e);
        }
    }
}
