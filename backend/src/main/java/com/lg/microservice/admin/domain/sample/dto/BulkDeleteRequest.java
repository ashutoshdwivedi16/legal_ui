package com.lg.microservice.admin.domain.sample.dto;

import java.util.List;

/**
 * Request DTO for bulk deleting sample items.
 */
public record BulkDeleteRequest(List<Long> ids) {}
