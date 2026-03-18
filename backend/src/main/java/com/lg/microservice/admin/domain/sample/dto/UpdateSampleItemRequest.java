package com.lg.microservice.admin.domain.sample.dto;

import jakarta.validation.constraints.Size;

/**
 * Request DTO for updating a sample item.
 * All fields are optional - only provided fields will be updated.
 */
public record UpdateSampleItemRequest(
        @Size(min = 1, max = 100, message = "Name must be between 1 and 100 characters")
        String name,

        @Size(max = 500, message = "Description must not exceed 500 characters")
        String description,

        SampleItemStatus status
) {}
