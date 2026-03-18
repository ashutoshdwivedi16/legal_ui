package com.lg.microservice.admin.common.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lg.microservice.admin.core.factory.AuthProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.stereotype.Component;

import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class AuthConfig {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    private final Map<String, AuthProvider> issuerProviderMap;
    private final Map<String, JwtDecoder> issuerDecoderMap;

    public AuthConfig(List<AuthProvider> authProviders) {
        this.issuerProviderMap = new HashMap<>();
        this.issuerDecoderMap = new HashMap<>();

        for (AuthProvider provider : authProviders) {
            try {
                String issuer = provider.getIssuer();
                if (issuer != null) {
                    issuerProviderMap.put(issuer, provider);
                    issuerDecoderMap.put(issuer, provider.createJwtDecoder());
                    log.info("Registered auth provider: {} (issuer={})", provider.getProviderType(), issuer);
                }
            } catch (UnsupportedOperationException e) {
                // Provider doesn't support JWT auth — skip
            }
        }

        if (issuerDecoderMap.isEmpty()) {
            throw new IllegalStateException("No JWT-capable auth provider found");
        }
    }

    public AuthProvider getProvider(Jwt jwt) {
        String issuer = jwt.getClaimAsString("iss");
        AuthProvider provider = issuerProviderMap.get(issuer);
        if (provider == null) {
            throw new IllegalStateException("No auth provider found for issuer: " + issuer);
        }
        return provider;
    }

    public JwtDecoder getDecoder(String issuer) {
        return issuerDecoderMap.get(issuer);
    }

    public String peekIssuer(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length < 2) {
                return null;
            }
            byte[] payload = Base64.getUrlDecoder().decode(parts[1]);
            JsonNode json = objectMapper.readTree(payload);
            JsonNode issNode = json.get("iss");
            return issNode != null ? issNode.asText() : null;
        } catch (Exception e) {
            log.debug("Failed to peek issuer from token", e);
            return null;
        }
    }
}
