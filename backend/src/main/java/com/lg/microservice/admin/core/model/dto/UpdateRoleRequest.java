package com.lg.microservice.admin.core.model.dto;

import java.util.List;

public record UpdateRoleRequest(
    String name,
    String description,
    Boolean active,
    Boolean isAdmin,
    List<Long> permissionIds
) {}
