package com.lg.microservice.admin.core.model.dto;

public record RoleDto(
    Long id,
    String name,
    String description,
    Boolean active
) {}
