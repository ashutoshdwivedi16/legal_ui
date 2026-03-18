package com.lg.microservice.admin.core.service.impl;

import com.lg.microservice.admin.common.response.DataResponse;
import com.lg.microservice.admin.common.response.PageResponse;
import com.lg.microservice.admin.core.model.dto.CreateRoleRequest;
import com.lg.microservice.admin.core.model.dto.PermissionDto;
import com.lg.microservice.admin.core.model.dto.RoleDetailDto;
import com.lg.microservice.admin.core.model.dto.UpdateRoleRequest;
import com.lg.microservice.admin.core.model.entity.Permission;
import com.lg.microservice.admin.core.model.entity.Role;
import com.lg.microservice.admin.core.repository.PermissionRepository;
import com.lg.microservice.admin.core.repository.RoleRepository;
import com.lg.microservice.admin.core.service.RoleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoleServiceImpl implements RoleService {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<RoleDetailDto> getRoles(String name, Pageable pageable) {
        Page<Role> roles;
        
        if (name != null && !name.isBlank()) {
            roles = roleRepository.findByNameContainingIgnoreCase(name, pageable);
        } else {
            roles = roleRepository.findAll(pageable);
        }
        
        Page<RoleDetailDto> roleDtos = roles.map(this::toRoleDetailDtoWithoutPermissions);
        return PageResponse.of(roleDtos);
    }

    @Override
    @Transactional(readOnly = true)
    public DataResponse<RoleDetailDto> getRole(Long id) {
        Role role = roleRepository.findWithPermissionsById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found"));
        
        return DataResponse.of(toRoleDetailDto(role));
    }

    @Override
    @Transactional
    public DataResponse<RoleDetailDto> createRole(CreateRoleRequest request) {
        String normalizedName = request.name().trim();
        if (roleRepository.existsByName(normalizedName)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Role name already exists");
        }

        boolean isAdmin = request.isAdmin() != null && request.isAdmin();
        
        Role role = Role.builder()
                .name(normalizedName)
                .description(request.description())
                .isAdmin(isAdmin)
                .active(true)
                .build();

        // Skip permission assignment for admin roles - they get all permissions dynamically
        if (!isAdmin && request.permissionIds() != null && !request.permissionIds().isEmpty()) {
            Set<Permission> permissions = fetchPermissionsByIds(request.permissionIds());
            role.setPermissions(permissions);
        }

        role = roleRepository.save(role);
        log.info("Created role with id: {} and name: {}", role.getId(), role.getName());

        role = roleRepository.findWithPermissionsById(role.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to reload role"));

        return DataResponse.of(toRoleDetailDto(role));
    }

    @Override
    @Transactional
    public DataResponse<RoleDetailDto> updateRole(Long id, UpdateRoleRequest request) {
        Role role = roleRepository.findWithPermissionsById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found"));

        if (request.name() != null && !request.name().isBlank()) {
            String normalizedName = request.name().trim();
            if (!normalizedName.equals(role.getName()) && roleRepository.existsByName(normalizedName)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Role name already exists");
            }
            role.setName(normalizedName);
        }

        if (request.description() != null) {
            role.setDescription(request.description());
        }

        if (request.active() != null) {
            role.setActive(request.active());
        }

        if (request.isAdmin() != null) {
            role.setIsAdmin(request.isAdmin());
        }

        // Determine if role is/will be admin (either already was or being set to admin)
        boolean roleIsAdmin = Boolean.TRUE.equals(role.getIsAdmin());

        // Skip permission updates for admin roles - they get all permissions dynamically
        if (!roleIsAdmin && request.permissionIds() != null) {
            if (request.permissionIds().isEmpty()) {
                role.setPermissions(new HashSet<>());
            } else {
                Set<Permission> permissions = fetchPermissionsByIds(request.permissionIds());
                role.setPermissions(permissions);
            }
        } else if (roleIsAdmin) {
            // Clear any existing permissions for admin roles
            role.setPermissions(new HashSet<>());
        }

        role = roleRepository.save(role);
        log.info("Updated role with id: {}", role.getId());

        role = roleRepository.findWithPermissionsById(role.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to reload role"));

        return DataResponse.of(toRoleDetailDto(role));
    }

    @Override
    @Transactional
    public DataResponse<Void> deleteRole(Long id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Role not found"));

        if (Boolean.TRUE.equals(role.getIsAdmin())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot delete admin roles");
        }

        roleRepository.delete(role);
        log.info("Deleted role with id: {}", id);

        return DataResponse.of(null);
    }

    @Override
    @Transactional(readOnly = true)
    public DataResponse<List<RoleDetailDto>> getActiveRoles() {
        List<Role> roles = roleRepository.findAllByActiveTrue();
        
        List<RoleDetailDto> roleDtos = roles.stream()
                .map(this::toRoleDetailDto)
                .collect(Collectors.toList());
        
        return DataResponse.of(roleDtos);
    }

    private Set<Permission> fetchPermissionsByIds(List<Long> permissionIds) {
        List<Permission> permissions = permissionRepository.findAllById(permissionIds);
        if (permissions.size() != permissionIds.size()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "One or more permissions not found");
        }
        return new HashSet<>(permissions);
    }

    private RoleDetailDto toRoleDetailDto(Role role) {
        List<PermissionDto> permissionDtos = role.getPermissions().stream()
                .map(this::toPermissionDto)
                .collect(Collectors.toList());

        return new RoleDetailDto(
                role.getId(),
                role.getName(),
                role.getDescription(),
                role.getActive(),
                role.getIsAdmin(),
                permissionDtos,
                role.getCreatedAt(),
                role.getUpdatedAt()
        );
    }

    private RoleDetailDto toRoleDetailDtoWithoutPermissions(Role role) {
        return new RoleDetailDto(
                role.getId(),
                role.getName(),
                role.getDescription(),
                role.getActive(),
                role.getIsAdmin(),
                List.of(),
                role.getCreatedAt(),
                role.getUpdatedAt()
        );
    }

    private PermissionDto toPermissionDto(Permission permission) {
        return new PermissionDto(
                permission.getId(),
                permission.getResource(),
                permission.getAction(),
                permission.getPermissionString()
        );
    }
}
