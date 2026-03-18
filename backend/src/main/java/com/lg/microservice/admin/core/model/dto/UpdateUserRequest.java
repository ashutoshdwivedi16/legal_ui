package com.lg.microservice.admin.core.model.dto;

public record UpdateUserRequest(
    String firstName,
    String lastName,
    Boolean active
) {}
