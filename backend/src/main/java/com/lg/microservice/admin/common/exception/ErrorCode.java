package com.lg.microservice.admin.common.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    INTERNAL_SERVER_ERROR("INTERNAL_ERROR", "An unexpected error occurred"),
    BAD_REQUEST("BAD_REQUEST", "Invalid request"),
    UNAUTHORIZED("UNAUTHORIZED", "Authentication required"),
    FORBIDDEN("FORBIDDEN", "Access denied"),
    NOT_FOUND("NOT_FOUND", "Resource not found"),
    CONFLICT("CONFLICT", "Resource already exists"),
    VALIDATION_ERROR("VALIDATION_ERROR", "Validation failed"),

    USER_NOT_FOUND("USER_NOT_FOUND", "User not found"),
    USER_ALREADY_EXISTS("USER_ALREADY_EXISTS", "User with this email already exists"),
    USER_INACTIVE("USER_INACTIVE", "User account is inactive"),

    ROLE_NOT_FOUND("ROLE_NOT_FOUND", "Role not found"),
    ROLE_ALREADY_EXISTS("ROLE_ALREADY_EXISTS", "Role with this name already exists"),
    ROLE_IN_USE("ROLE_IN_USE", "Role is assigned to users and cannot be deleted"),

    PERMISSION_NOT_FOUND("PERMISSION_NOT_FOUND", "Permission not found"),
    PERMISSION_ALREADY_EXISTS("PERMISSION_ALREADY_EXISTS", "Permission already exists"),
    PERMISSION_DENIED("PERMISSION_DENIED", "You don't have permission to perform this action"),

    TOKEN_EXPIRED("TOKEN_EXPIRED", "Authentication token has expired"),
    TOKEN_INVALID("TOKEN_INVALID", "Invalid authentication token"),
    REFRESH_TOKEN_EXPIRED("REFRESH_TOKEN_EXPIRED", "Refresh token has expired"),
    REFRESH_TOKEN_INVALID("REFRESH_TOKEN_INVALID", "Invalid refresh token"),

    EXTERNAL_SERVICE_ERROR("EXTERNAL_SERVICE_ERROR", "External service is unavailable"),
    PROXY_ERROR("PROXY_ERROR", "Error forwarding request to downstream service"),
    AUDIT_LOG_NOT_FOUND("AUDIT_LOG_NOT_FOUND", "Audit log not found");

    private final String code;
    private final String message;
}
