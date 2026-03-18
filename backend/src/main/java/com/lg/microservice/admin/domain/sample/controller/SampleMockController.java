package com.lg.microservice.admin.domain.sample.controller;

import com.lg.microservice.admin.common.response.DataResponse;
import com.lg.microservice.admin.common.response.ErrorResponse;
import com.lg.microservice.admin.common.response.PageResponse;
import com.lg.microservice.admin.domain.sample.dto.BulkDeleteRequest;
import com.lg.microservice.admin.domain.sample.dto.CreateSampleItemRequest;
import com.lg.microservice.admin.domain.sample.dto.SampleItemDto;
import com.lg.microservice.admin.domain.sample.dto.UpdateSampleItemRequest;
import com.lg.microservice.admin.domain.sample.store.SampleMockDataStore;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Mock backend controller for the sample service.
 * 
 * This controller simulates an external microservice for testing the proxy pattern.
 * It receives HTTP calls from ServiceClient and returns mock data from an in-memory store.
 * 
 * Path: /mock/sample/**
 * 
 * This is a REFERENCE IMPLEMENTATION demonstrating:
 * - Standard REST API patterns
 * - Pagination support
 * - Validation
 * - Error responses
 * - OpenAPI documentation
 */
@RestController
@RequestMapping("/mock/sample")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Sample Mock Service", description = "Internal mock service for testing the proxy pattern (Reference Implementation)")
public class SampleMockController {

    private final SampleMockDataStore dataStore;

    @Operation(summary = "List all sample items", description = "Returns a paginated list of sample items")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Successfully retrieved list",
                    content = @Content(schema = @Schema(implementation = PageResponse.class)))
    })
    @GetMapping("/items")
    public ResponseEntity<PageResponse<SampleItemDto>> getItems(
            @Parameter(description = "Page number (0-based)") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Search query") @RequestParam(defaultValue = "") String query,
            @Parameter(description = "Status filter") @RequestParam(defaultValue = "all") String status,
            @Parameter(description = "Sort field and direction (e.g. 'name,asc')") @RequestParam(defaultValue = "id,desc") String sort) {
        
        log.debug("Mock: GET /items page={} size={} query={} status={} sort={}", page, size, query, status, sort);
        
        String[] sortParams = sort.split(",");
        Sort.Direction direction = sortParams.length > 1 && "asc".equalsIgnoreCase(sortParams[1])
                ? Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortParams[0]));
        
        Page<SampleItemDto> items = dataStore.findAll(pageable, query, status);
        
        return ResponseEntity.ok(PageResponse.of(items));
    }

    @Operation(summary = "Get a sample item by ID", description = "Returns a single sample item")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Successfully retrieved item",
                    content = @Content(schema = @Schema(implementation = DataResponse.class))),
            @ApiResponse(responseCode = "404", description = "Item not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping("/items/{id}")
    public ResponseEntity<?> getItem(
            @Parameter(description = "Item ID") @PathVariable Long id) {
        
        log.debug("Mock: GET /items/{}", id);
        
        return dataStore.findById(id)
                .map(item -> ResponseEntity.ok(DataResponse.of(item)))
                .orElseGet(() -> ResponseEntity
                        .status(HttpStatus.NOT_FOUND)
                        .body(DataResponse.error("Item not found: " + id)));
    }

    @Operation(summary = "Create a new sample item", description = "Creates a new sample item and returns it")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "201", description = "Successfully created item",
                    content = @Content(schema = @Schema(implementation = DataResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid request",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/items")
    public ResponseEntity<DataResponse<SampleItemDto>> createItem(
            @Valid @RequestBody CreateSampleItemRequest request) {
        
        log.debug("Mock: POST /items name={}", request.name());
        
        SampleItemDto created = dataStore.create(request);
        
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(DataResponse.of(created, "Item created successfully"));
    }

    @Operation(summary = "Update a sample item", description = "Updates an existing sample item")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Successfully updated item",
                    content = @Content(schema = @Schema(implementation = DataResponse.class))),
            @ApiResponse(responseCode = "404", description = "Item not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PutMapping("/items/{id}")
    public ResponseEntity<?> updateItem(
            @Parameter(description = "Item ID") @PathVariable Long id,
            @Valid @RequestBody UpdateSampleItemRequest request) {
        
        log.debug("Mock: PUT /items/{}", id);
        
        return dataStore.update(id, request)
                .map(item -> ResponseEntity.ok(DataResponse.of(item, "Item updated successfully")))
                .orElseGet(() -> ResponseEntity
                        .status(HttpStatus.NOT_FOUND)
                        .body(DataResponse.error("Item not found: " + id)));
    }

    @Operation(summary = "Delete a sample item", description = "Deletes a sample item by ID")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "204", description = "Successfully deleted item"),
            @ApiResponse(responseCode = "404", description = "Item not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @DeleteMapping("/items/{id}")
    public ResponseEntity<?> deleteItem(
            @Parameter(description = "Item ID") @PathVariable Long id) {
        
        log.debug("Mock: DELETE /items/{}", id);
        
        if (dataStore.delete(id)) {
            return ResponseEntity.noContent().build();
        }
        
        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(DataResponse.error("Item not found: " + id));
    }

    @Operation(summary = "Bulk delete sample items", description = "Deletes multiple sample items by IDs")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "204", description = "Successfully deleted items")
    })
    @DeleteMapping("/items")
    public ResponseEntity<Void> deleteItems(@RequestBody BulkDeleteRequest request) {
        log.debug("Mock: DELETE /items bulk ids={}", request.ids());
        dataStore.deleteItems(request.ids());
        return ResponseEntity.noContent().build();
    }
}
