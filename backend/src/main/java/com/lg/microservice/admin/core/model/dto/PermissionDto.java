package com.lg.microservice.admin.core.model.dto;

public record PermissionDto(
    Long id,
    String resource,
    String action,
    String permissionString
) {}
