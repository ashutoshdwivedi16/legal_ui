package com.lg.microservice.admin.core.model.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CreateUserRequest(
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    String email,
    String firstName,
    String lastName,
    List<Long> roleIds,
    @Size(min = 8, message = "Temporary password must be at least 8 characters")
    String temporaryPassword
) {}
