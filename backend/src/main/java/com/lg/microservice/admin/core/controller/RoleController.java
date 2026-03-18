package com.lg.microservice.admin.core.controller;

import com.lg.microservice.admin.common.response.DataResponse;
import com.lg.microservice.admin.common.response.PageResponse;
import com.lg.microservice.admin.core.model.dto.CreateRoleRequest;
import com.lg.microservice.admin.core.model.dto.RoleDetailDto;
import com.lg.microservice.admin.core.model.dto.UpdateRoleRequest;
import com.lg.microservice.admin.core.service.RoleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/v1/roles")
@RequiredArgsConstructor
@Tag(name = "Role Management", description = "Role CRUD operations")
public class RoleController {

    private final RoleService roleService;

    @Operation(summary = "List roles")
    @PreAuthorize("hasAuthority('admin.roles:read')")
    @GetMapping
    public ResponseEntity<PageResponse<RoleDetailDto>> getRoles(
            @RequestParam(required = false) String name,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "DESC") String sortDir) {
        Sort sort = sortDir.equalsIgnoreCase("ASC") ? Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);
        return ResponseEntity.ok(roleService.getRoles(name, pageable));
    }

    @Operation(summary = "Get role by ID")
    @PreAuthorize("hasAuthority('admin.roles:read')")
    @GetMapping("/{id}")
    public ResponseEntity<DataResponse<RoleDetailDto>> getRole(@PathVariable Long id) {
        return ResponseEntity.ok(roleService.getRole(id));
    }

    @Operation(summary = "Create role")
    @PreAuthorize("hasAuthority('admin.roles:create')")
    @PostMapping
    public ResponseEntity<DataResponse<RoleDetailDto>> createRole(@RequestBody CreateRoleRequest request) {
        return ResponseEntity.ok(roleService.createRole(request));
    }

    @Operation(summary = "Update role")
    @PreAuthorize("hasAuthority('admin.roles:update')")
    @PutMapping("/{id}")
    public ResponseEntity<DataResponse<RoleDetailDto>> updateRole(
            @PathVariable Long id,
            @RequestBody UpdateRoleRequest request) {
        return ResponseEntity.ok(roleService.updateRole(id, request));
    }

    @Operation(summary = "Delete role")
    @PreAuthorize("hasAuthority('admin.roles:delete')")
    @DeleteMapping("/{id}")
    public ResponseEntity<DataResponse<Void>> deleteRole(@PathVariable Long id) {
        return ResponseEntity.ok(roleService.deleteRole(id));
    }

    @Operation(summary = "Get active roles for dropdown")
    @PreAuthorize("hasAuthority('admin.roles:read')")
    @GetMapping("/active")
    public ResponseEntity<DataResponse<List<RoleDetailDto>>> getActiveRoles() {
        return ResponseEntity.ok(roleService.getActiveRoles());
    }
}
