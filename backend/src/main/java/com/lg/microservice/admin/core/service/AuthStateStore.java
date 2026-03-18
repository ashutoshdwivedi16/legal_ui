package com.lg.microservice.admin.core.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;

@Component
@RequiredArgsConstructor
public class AuthStateStore {

    private static final String PKCE_PREFIX = "pkce:";
    private static final Duration PKCE_TTL = Duration.ofMinutes(10);
    private static final int CODE_VERIFIER_LENGTH = 64;

    private final StringRedisTemplate redisTemplate;
    private final SecureRandom secureRandom = new SecureRandom();

    public String generateAndStoreCodeVerifier(String state) {
        String codeVerifier = generateCodeVerifier();
        String key = PKCE_PREFIX + state;
        redisTemplate.opsForValue().set(key, codeVerifier, PKCE_TTL);
        return codeVerifier;
    }

    public String retrieveAndRemoveCodeVerifier(String state) {
        String key = PKCE_PREFIX + state;
        String codeVerifier = redisTemplate.opsForValue().get(key);
        if (codeVerifier != null) {
            redisTemplate.delete(key);
        }
        return codeVerifier;
    }

    public String computeCodeChallenge(String codeVerifier) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(codeVerifier.getBytes(StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    private String generateCodeVerifier() {
        byte[] randomBytes = new byte[CODE_VERIFIER_LENGTH];
        secureRandom.nextBytes(randomBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
    }
}
