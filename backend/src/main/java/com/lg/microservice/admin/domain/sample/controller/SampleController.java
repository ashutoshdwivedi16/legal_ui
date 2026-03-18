package com.lg.microservice.admin.domain.sample.controller;

import com.lg.microservice.admin.common.response.DataResponse;
import com.lg.microservice.admin.common.response.PageResponse;
import com.lg.microservice.admin.domain.sample.dto.BulkDeleteRequest;
import com.lg.microservice.admin.domain.sample.dto.CreateSampleItemRequest;
import com.lg.microservice.admin.domain.sample.dto.SampleItemDto;
import com.lg.microservice.admin.domain.sample.dto.UpdateSampleItemRequest;
import com.lg.microservice.admin.domain.sample.service.SampleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/sample")
@RequiredArgsConstructor
@Tag(name = "Sample Service", description = "Sample service proxy - Reference implementation for service integrations")
public class SampleController {

    private final SampleService sampleService;

    @Operation(summary = "List sample items", description = "Proxies to sample service to list items with pagination")
    @PreAuthorize("hasAuthority('sample:read')")
    @GetMapping("/items")
    public ResponseEntity<PageResponse<SampleItemDto>> getItems(
            @Parameter(description = "Search query") @RequestParam(defaultValue = "") String query,
            @Parameter(description = "Status filter") @RequestParam(defaultValue = "all") String status,
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Sort field and direction (e.g. 'name,asc')") @RequestParam(defaultValue = "id,desc") String sort) {
        return ResponseEntity.ok(sampleService.getItems(page, size, query, status, sort));
    }

    @Operation(summary = "Get sample item by ID", description = "Proxies to sample service to get a single item")
    @PreAuthorize("hasAuthority('sample:read')")
    @GetMapping("/items/{id}")
    public ResponseEntity<DataResponse<SampleItemDto>> getItem(
            @Parameter(description = "Item ID") @PathVariable Long id) {
        return ResponseEntity.ok(sampleService.getItem(id));
    }

    @Operation(summary = "Create sample item", description = "Proxies to sample service to create a new item")
    @PreAuthorize("hasAuthority('sample:create')")
    @PostMapping("/items")
    public ResponseEntity<DataResponse<SampleItemDto>> createItem(
            @RequestBody CreateSampleItemRequest request) {
        return ResponseEntity.ok(sampleService.createItem(request));
    }

    @Operation(summary = "Update sample item", description = "Proxies to sample service to update an existing item")
    @PreAuthorize("hasAuthority('sample:update')")
    @PutMapping("/items/{id}")
    public ResponseEntity<DataResponse<SampleItemDto>> updateItem(
            @Parameter(description = "Item ID") @PathVariable Long id,
            @RequestBody UpdateSampleItemRequest request) {
        return ResponseEntity.ok(sampleService.updateItem(id, request));
    }

    @Operation(summary = "Delete sample item", description = "Proxies to sample service to delete an item")
    @PreAuthorize("hasAuthority('sample:delete')")
    @DeleteMapping("/items/{id}")
    public ResponseEntity<Void> deleteItem(
            @Parameter(description = "Item ID") @PathVariable Long id) {
        sampleService.deleteItem(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Bulk delete sample items", description = "Proxies to sample service to delete multiple items")
    @PreAuthorize("hasAuthority('sample:delete')")
    @DeleteMapping("/items")
    public ResponseEntity<Void> deleteItems(@RequestBody BulkDeleteRequest request) {
        sampleService.deleteItems(request.ids());
        return ResponseEntity.noContent().build();
    }
}
