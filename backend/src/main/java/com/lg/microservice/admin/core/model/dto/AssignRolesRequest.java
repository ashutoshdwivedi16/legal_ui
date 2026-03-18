package com.lg.microservice.admin.core.model.dto;

import jakarta.validation.constraints.NotNull;
import java.util.List;

public record AssignRolesRequest(
    @NotNull(message = "Role IDs are required")
    List<Long> roleIds
) {}
