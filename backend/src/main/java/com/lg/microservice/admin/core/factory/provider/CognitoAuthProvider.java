package com.lg.microservice.admin.core.factory.provider;

import com.lg.microservice.admin.core.factory.AuthProvider;
import com.lg.microservice.admin.core.factory.AuthProviderProperties;
import com.lg.microservice.admin.core.model.dto.TokenResponse;
import com.lg.microservice.admin.core.model.entity.User;
import com.lg.microservice.admin.core.service.UserService;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "auth.provider.type", havingValue = "cognito", matchIfMissing = true)
public class CognitoAuthProvider implements AuthProvider {

    private final AuthProviderProperties properties;
    private final RestTemplate restTemplate;
    private final UserService userService;

    @Override
    public String getProviderType() {
        return "cognito";
    }

    @Override
    public String getProviderMode() {
        return "hosted";
    }

    @Override
    public String getIssuer() {
        return properties.getCognito().getIssuerUri();
    }

    @Override
    public User getUser(Jwt jwt) {
        String externalUserId = jwt.getSubject();
        return userService.getUserByExternalId(externalUserId);
    }

    @Override
    public User syncUserFromCallback(TokenResponse tokenResponse) {
        if (tokenResponse.getIdToken() == null || tokenResponse.getIdToken().isEmpty()) {
            log.warn("No ID token received, user profile may be incomplete");
            return null;
        }

        try {
            SignedJWT signedJwt = SignedJWT.parse(tokenResponse.getIdToken());
            JWTClaimsSet claims = signedJwt.getJWTClaimsSet();

            String sub = claims.getSubject();
            String email = claims.getStringClaim("email");
            String firstName = claims.getStringClaim("given_name");
            String lastName = claims.getStringClaim("family_name");

            log.debug("Syncing user from ID token: sub={}, email={}", sub, email);
            return userService.syncUser(sub, email, firstName, lastName);
        } catch (Exception e) {
            log.error("Failed to parse ID token for user sync", e);
            throw new RuntimeException("Failed to sync user from callback", e);
        }
    }

    @Override
    public String getLoginUrl(String state, String codeChallenge, String redirectUri) {
        AuthProviderProperties.CognitoProperties cognito = properties.getCognito();
        return String.format(
                "%s/oauth2/authorize?client_id=%s&response_type=code&scope=openid+email+profile"
                        + "&redirect_uri=%s&state=%s&code_challenge=%s&code_challenge_method=S256",
                cognito.getDomain(),
                cognito.getClientId(),
                URLEncoder.encode(redirectUri != null ? redirectUri : cognito.getRedirectUri(), StandardCharsets.UTF_8),
                state,
                codeChallenge
        );
    }

    @Override
    public String getLogoutUrl(String redirectUri) {
        AuthProviderProperties.CognitoProperties cognito = properties.getCognito();
        return String.format(
                "%s/logout?client_id=%s&logout_uri=%s",
                cognito.getDomain(),
                cognito.getClientId(),
                URLEncoder.encode(redirectUri, StandardCharsets.UTF_8)
        );
    }

    @Override
    public String getChangePasswordUrl(String redirectUri) {
        AuthProviderProperties.CognitoProperties cognito = properties.getCognito();
        return String.format(
                "%s/forgotPassword?client_id=%s&redirect_uri=%s",
                cognito.getDomain(),
                cognito.getClientId(),
                URLEncoder.encode(redirectUri, StandardCharsets.UTF_8)
        );
    }

    @Override
    public TokenResponse exchangeCodeForTokens(String code, String codeVerifier, String redirectUri) {
        AuthProviderProperties.CognitoProperties cognito = properties.getCognito();
        String tokenEndpoint = cognito.getDomain() + "/oauth2/token";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "authorization_code");
        body.add("client_id", cognito.getClientId());
        if (cognito.getClientSecret() != null && !cognito.getClientSecret().isEmpty()) {
            body.add("client_secret", cognito.getClientSecret());
        }
        body.add("code", code);
        body.add("redirect_uri", redirectUri != null ? redirectUri : cognito.getRedirectUri());
        body.add("code_verifier", codeVerifier);

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(tokenEndpoint, request, Map.class);
            return extractTokenResponse(response.getBody());
        } catch (Exception e) {
            log.error("Failed to exchange code for tokens", e);
            throw new RuntimeException("Failed to exchange authorization code for tokens", e);
        }
    }

    @Override
    public TokenResponse refreshAccessToken(String refreshToken) {
        AuthProviderProperties.CognitoProperties cognito = properties.getCognito();
        String tokenEndpoint = cognito.getDomain() + "/oauth2/token";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "refresh_token");
        body.add("client_id", cognito.getClientId());
        body.add("refresh_token", refreshToken);

        if (cognito.getClientSecret() != null && !cognito.getClientSecret().isEmpty()) {
            body.add("client_secret", cognito.getClientSecret());
        }

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(tokenEndpoint, request, Map.class);
            return extractTokenResponse(response.getBody());
        } catch (Exception e) {
            log.error("Failed to refresh access token", e);
            throw new RuntimeException("Failed to refresh access token", e);
        }
    }

    @Override
    public void revokeToken(String token) {
        AuthProviderProperties.CognitoProperties cognito = properties.getCognito();
        String revokeEndpoint = cognito.getDomain() + "/oauth2/revoke";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("token", token);
        body.add("client_id", cognito.getClientId());

        if (cognito.getClientSecret() != null && !cognito.getClientSecret().isEmpty()) {
            body.add("client_secret", cognito.getClientSecret());
        }

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);

        try {
            restTemplate.postForEntity(revokeEndpoint, request, Void.class);
            log.info("Successfully revoked token");
        } catch (Exception e) {
            log.error("Failed to revoke token", e);
        }
    }

    @Override
    public JwtDecoder createJwtDecoder() {
        String validationMethod = properties.getValidationMethod();
        String issuerUri = properties.getCognito().getIssuerUri();

        if ("public-key".equalsIgnoreCase(validationMethod)) {
            return createPublicKeyDecoder();
        }

        return NimbusJwtDecoder.withJwkSetUri(issuerUri + "/.well-known/jwks.json")
                .build();
    }

    private JwtDecoder createPublicKeyDecoder() {
        String publicKey = properties.getCognito().getPublicKey();
        if (publicKey == null || publicKey.trim().isEmpty()) {
            throw new IllegalStateException(
                    "Public key validation method requires auth.provider.cognito.public-key to be configured");
        }

        try {
            RSAPublicKey rsaPublicKey = parsePublicKey(publicKey);
            return NimbusJwtDecoder.withPublicKey(rsaPublicKey).build();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to parse public key", e);
        }
    }

    @Override
    public String getRedirectUri() {
        return properties.getCognito().getRedirectUri();
    }

    @Override
    public String getPostLogoutRedirectUri() {
        return properties.getCognito().getPostLogoutRedirectUri();
    }

    private RSAPublicKey parsePublicKey(String pemKey) throws Exception {
        String publicKeyPem = pemKey
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s", "");

        byte[] keyBytes = Base64.getDecoder().decode(publicKeyPem);
        X509EncodedKeySpec spec = new X509EncodedKeySpec(keyBytes);
        KeyFactory keyFactory = KeyFactory.getInstance("RSA");
        return (RSAPublicKey) keyFactory.generatePublic(spec);
    }

    @SuppressWarnings("unchecked")
    private TokenResponse extractTokenResponse(Map<String, Object> responseBody) {
        if (responseBody == null) {
            throw new IllegalStateException("Empty token response from Cognito");
        }

        return TokenResponse.builder()
                .accessToken((String) responseBody.get("access_token"))
                .refreshToken((String) responseBody.get("refresh_token"))
                .idToken((String) responseBody.get("id_token"))
                .tokenType((String) responseBody.get("token_type"))
                .expiresIn(responseBody.get("expires_in") != null
                        ? ((Number) responseBody.get("expires_in")).longValue()
                        : 3600L)
                .build();
    }
}
