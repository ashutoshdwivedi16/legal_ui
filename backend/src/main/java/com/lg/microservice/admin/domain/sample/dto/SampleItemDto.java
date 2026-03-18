package com.lg.microservice.admin.domain.sample.dto;

import java.time.LocalDateTime;

/**
 * Sample item DTO for the reference implementation.
 */
public record SampleItemDto(
        Long id,
        String name,
        String description,
        SampleItemStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    /**
     * Create a new SampleItemDto with current timestamps.
     */
    public static SampleItemDto create(Long id, String name, String description, SampleItemStatus status) {
        LocalDateTime now = LocalDateTime.now();
        return new SampleItemDto(id, name, description, status, now, now);
    }

    /**
     * Create updated copy with new updatedAt timestamp.
     */
    public SampleItemDto withUpdates(String name, String description, SampleItemStatus status) {
        return new SampleItemDto(
            this.id,
            name != null ? name : this.name,
            description != null ? description : this.description,
            status != null ? status : this.status,
            this.createdAt,
            LocalDateTime.now()
        );
    }
}
