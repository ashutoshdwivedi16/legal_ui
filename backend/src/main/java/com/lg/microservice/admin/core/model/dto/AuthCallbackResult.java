package com.lg.microservice.admin.core.model.dto;

import lombok.Builder;
import lombok.Getter;
import org.springframework.http.ResponseCookie;

@Getter
@Builder
public class AuthCallbackResult {
    private final boolean success;
    private final String redirectLocation;
    private final ResponseCookie refreshTokenCookie;
}
