package com.lg.microservice.admin.core.model.dto;

import java.time.LocalDateTime;
import java.util.List;

public record RoleDetailDto(
    Long id,
    String name,
    String description,
    Boolean active,
    Boolean isAdmin,
    List<PermissionDto> permissions,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {}
