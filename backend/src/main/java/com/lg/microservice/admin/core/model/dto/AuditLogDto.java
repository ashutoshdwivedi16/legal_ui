package com.lg.microservice.admin.core.model.dto;

import java.time.LocalDateTime;
import java.util.Map;

public record AuditLogDto(
    Long id,
    LocalDateTime timestamp,
    Long userId,
    String userEmail,
    String action,
    String resourceType,
    Long resourceId,
    Map<String, Object> details,
    String ipAddress,
    String userAgent,
    Boolean success,
    String errorMessage,
    String serviceName,
    String endpoint,
    String httpMethod,
    String correlationId
) {}
