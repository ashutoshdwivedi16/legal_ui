package com.lg.microservice.admin.core.model.dto;

import java.util.List;

public record CreateRoleRequest(
    String name,
    String description,
    Boolean isAdmin,
    List<Long> permissionIds
) {}
