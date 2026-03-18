package com.lg.microservice.admin.core.factory;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class AuthProviderFactory {

    private final List<AuthProvider> authProviders;

    public AuthProviderFactory(List<AuthProvider> authProviders) {
        this.authProviders = authProviders;
    }

    public AuthProvider getAuthProvider(String type, String mode) {
        return authProviders.stream()
                .filter(provider -> provider.getProviderType().equals(type)
                        && provider.getProviderMode().equals(mode))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Auth provider not found: " + type + "/" + mode));
    }

    public AuthProvider getDefaultAuthProvider(AuthProviderProperties properties) {
        return getAuthProvider(properties.getType(), properties.getMode());
    }
}
