package com.lg.microservice.admin.core.controller;

import com.lg.microservice.admin.common.response.DataResponse;
import com.lg.microservice.admin.common.response.PageResponse;
import com.lg.microservice.admin.core.model.dto.AuditLogDto;
import com.lg.microservice.admin.core.model.dto.AuditLogListParams;
import com.lg.microservice.admin.core.service.AuditLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/v1/audit-logs")
@Tag(name = "Audit Logs", description = "Audit log viewing and export")
public class AuditLogController {

    private final AuditLogService auditLogService;

    public AuditLogController(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    @Operation(summary = "List audit logs with pagination and filtering")
    @PreAuthorize("hasAuthority('admin.audit-logs:read')")
    @GetMapping
    public ResponseEntity<PageResponse<AuditLogDto>> getAuditLogs(
            @RequestParam(required = false) String userEmail,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) String serviceName,
            @RequestParam(required = false) Boolean success,
            @RequestParam(required = false) LocalDateTime startDate,
            @RequestParam(required = false) LocalDateTime endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "id,desc") String sort) {

        String[] sortParams = sort.split(",");
        Sort.Direction direction = sortParams.length > 1 && "asc".equalsIgnoreCase(sortParams[1])
                ? Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortParams[0]));

        AuditLogListParams params = new AuditLogListParams(
                null,
                userEmail,
                action,
                resourceType,
                serviceName,
                success,
                startDate,
                endDate
        );

        Page<AuditLogDto> auditLogs = auditLogService.getAuditLogs(params, pageable);
        return ResponseEntity.ok(PageResponse.of(auditLogs));
    }

    @Operation(summary = "Get audit log by ID")
    @PreAuthorize("hasAuthority('admin.audit-logs:read')")
    @GetMapping("/{id}")
    public ResponseEntity<DataResponse<AuditLogDto>> getAuditLog(@PathVariable Long id) {
        return ResponseEntity.ok(DataResponse.of(auditLogService.getAuditLog(id)));
    }

    @Operation(summary = "Export audit logs")
    @PreAuthorize("hasAuthority('admin.audit-logs:read')")
    @GetMapping("/export")
    public ResponseEntity<DataResponse<List<AuditLogDto>>> exportAuditLogs(
            @RequestParam(required = false) String userEmail,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) String serviceName,
            @RequestParam(required = false) Boolean success,
            @RequestParam(required = false) LocalDateTime startDate,
            @RequestParam(required = false) LocalDateTime endDate) {

        AuditLogListParams params = new AuditLogListParams(
                null,
                userEmail,
                action,
                resourceType,
                serviceName,
                success,
                startDate,
                endDate
        );

        return ResponseEntity.ok(DataResponse.of(auditLogService.exportAuditLogs(params)));
    }
}
