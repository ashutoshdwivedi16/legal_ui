package com.lg.microservice.admin.core.model.dto;

import java.time.LocalDateTime;

public record AuditLogListParams(
    Long userId,
    String userEmail,
    String action,
    String resourceType,
    String serviceName,
    Boolean success,
    LocalDateTime startDate,
    LocalDateTime endDate
) {}
