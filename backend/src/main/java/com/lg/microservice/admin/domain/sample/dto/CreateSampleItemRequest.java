package com.lg.microservice.admin.domain.sample.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request DTO for creating a sample item.
 */
public record CreateSampleItemRequest(
        @NotBlank(message = "Name is required")
        @Size(min = 1, max = 100, message = "Name must be between 1 and 100 characters")
        String name,

        @Size(max = 500, message = "Description must not exceed 500 characters")
        String description,

        SampleItemStatus status
) {
    /**
     * Default status to PENDING if not provided.
     */
    public SampleItemStatus getEffectiveStatus() {
        return status != null ? status : SampleItemStatus.PENDING;
    }
}
