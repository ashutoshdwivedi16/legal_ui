package com.lg.microservice.admin.core.model.dto;

import lombok.Builder;
import lombok.Getter;
import org.springframework.http.ResponseCookie;

@Getter
@Builder
public class AuthLogoutResult {
    private final String logoutUrl;
    private final ResponseCookie clearRefreshTokenCookie;
}
