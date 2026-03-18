package com.lg.microservice.admin.core.model.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AuthRefreshResult {
    private final boolean success;
    private final String accessToken;
}
