package com.lg.microservice.admin.core.controller;

import com.lg.microservice.admin.common.response.DataResponse;
import com.lg.microservice.admin.core.model.dto.PermissionDto;
import com.lg.microservice.admin.core.model.dto.PermissionSyncResultDto;
import com.lg.microservice.admin.core.model.dto.PermissionTreeDto;
import com.lg.microservice.admin.core.service.PermissionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/v1/permissions")
@RequiredArgsConstructor
@Tag(name = "Permission Management", description = "Permission tree and sync operations")
public class PermissionController {

    private final PermissionService permissionService;

    @Operation(summary = "Get permission tree (grouped by resource)")
    @PreAuthorize("hasAuthority('admin.permissions:read')")
    @GetMapping
    public ResponseEntity<DataResponse<List<PermissionTreeDto>>> getPermissionTree() {
        return ResponseEntity.ok(permissionService.getPermissionTree());
    }

    @Operation(summary = "Get all permissions (flat list)")
    @PreAuthorize("hasAuthority('admin.permissions:read')")
    @GetMapping("/flat")
    public ResponseEntity<DataResponse<List<PermissionDto>>> getAllPermissions() {
        return ResponseEntity.ok(permissionService.getAllPermissions());
    }

    @Operation(summary = "Sync permissions from code annotations (PUBLIC - no auth)")
    @PostMapping("/sync")
    public ResponseEntity<DataResponse<PermissionSyncResultDto>> syncPermissions() {
        return ResponseEntity.ok(permissionService.syncPermissions());
    }
}
