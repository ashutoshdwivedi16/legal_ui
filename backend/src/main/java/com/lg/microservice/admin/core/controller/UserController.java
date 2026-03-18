package com.lg.microservice.admin.core.controller;

import com.lg.microservice.admin.common.response.DataResponse;
import com.lg.microservice.admin.common.response.PageResponse;
import com.lg.microservice.admin.core.model.dto.AssignRolesRequest;
import com.lg.microservice.admin.core.model.dto.CreateUserRequest;
import com.lg.microservice.admin.core.model.dto.RoleDto;
import com.lg.microservice.admin.core.model.dto.UpdateUserRequest;
import com.lg.microservice.admin.core.model.dto.UserDto;
import com.lg.microservice.admin.core.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
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

import java.util.List;

@RestController
@RequestMapping("/v1/users")
@RequiredArgsConstructor
@Tag(name = "User Management", description = "Admin user CRUD operations")
public class UserController {

    private final UserService userService;

    @Operation(summary = "List users with pagination and filtering")
    @PreAuthorize("hasAuthority('admin.users:read')")
    @GetMapping
    public ResponseEntity<PageResponse<UserDto>> getUsers(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "all") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "id,desc") String sort) {
        
        String[] sortParams = sort.split(",");
        Sort.Direction direction = sortParams.length > 1 && "asc".equalsIgnoreCase(sortParams[1]) 
            ? Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortParams[0]));
        
        Page<UserDto> users = userService.getUsers(query, status, pageable);
        return ResponseEntity.ok(PageResponse.of(users));
    }

    @Operation(summary = "Get user by ID")
    @PreAuthorize("hasAuthority('admin.users:read')")
    @GetMapping("/{id}")
    public ResponseEntity<DataResponse<UserDto>> getUser(@PathVariable Long id) {
        return ResponseEntity.ok(DataResponse.of(userService.getUser(id)));
    }

    @Operation(summary = "Create new user")
    @PreAuthorize("hasAuthority('admin.users:create')")
    @PostMapping
    public ResponseEntity<DataResponse<UserDto>> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserDto user = userService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(DataResponse.of(user));
    }

    @Operation(summary = "Update user")
    @PreAuthorize("hasAuthority('admin.users:update')")
    @PutMapping("/{id}")
    public ResponseEntity<DataResponse<UserDto>> updateUser(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(DataResponse.of(userService.updateUser(id, request)));
    }

    @Operation(summary = "Delete user")
    @PreAuthorize("hasAuthority('admin.users:delete')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Assign roles to user")
    @PreAuthorize("hasAuthority('admin.users:update')")
    @PutMapping("/{id}/roles")
    public ResponseEntity<DataResponse<UserDto>> assignRoles(
            @PathVariable Long id,
            @Valid @RequestBody AssignRolesRequest request) {
        return ResponseEntity.ok(DataResponse.of(userService.assignRoles(id, request)));
    }
}
