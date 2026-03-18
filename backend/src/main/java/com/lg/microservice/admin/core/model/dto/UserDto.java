package com.lg.microservice.admin.core.model.dto;

import java.time.LocalDateTime;
import java.util.List;

public record UserDto(
    Long id,
    String externalUserId,
    String email,
    String firstName,
    String lastName,
    Boolean active,
    List<RoleDto> roles,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {}
