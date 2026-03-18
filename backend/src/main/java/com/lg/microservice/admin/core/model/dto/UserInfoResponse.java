package com.lg.microservice.admin.core.model.dto;

import java.util.List;

public record UserInfoResponse(
        Long id,
        String externalUserId,
        String email,
        String firstName,
        String lastName,
        Boolean active,
        List<String> roles,
        List<String> permissions
) {}
