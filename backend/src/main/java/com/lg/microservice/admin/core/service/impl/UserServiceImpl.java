package com.lg.microservice.admin.core.service.impl;

import com.lg.microservice.admin.common.security.AuthConfig;
import com.lg.microservice.admin.core.factory.AuthProvider;
import com.lg.microservice.admin.core.factory.UserManagementProvider;
import com.lg.microservice.admin.core.model.dto.AssignRolesRequest;
import com.lg.microservice.admin.core.model.dto.CreateUserRequest;
import com.lg.microservice.admin.core.model.dto.RoleDto;
import com.lg.microservice.admin.core.model.dto.UpdateUserRequest;
import com.lg.microservice.admin.core.model.dto.UserDto;
import com.lg.microservice.admin.core.model.dto.UserInfoResponse;
import com.lg.microservice.admin.core.model.entity.Role;
import com.lg.microservice.admin.core.model.entity.User;
import com.lg.microservice.admin.core.repository.PermissionRepository;
import com.lg.microservice.admin.core.repository.RoleRepository;
import com.lg.microservice.admin.core.repository.UserRepository;
import com.lg.microservice.admin.core.service.UserService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Slf4j
@Service
public class UserServiceImpl implements UserService {

    private static final String DEFAULT_ROLE = "USER";

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final UserManagementProvider userManagementProvider;
    private final AuthConfig authConfig;

    public UserServiceImpl(UserRepository userRepository,
                           RoleRepository roleRepository,
                           PermissionRepository permissionRepository,
                           UserManagementProvider userManagementProvider,
                           @Lazy AuthConfig authConfig) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.userManagementProvider = userManagementProvider;
        this.authConfig = authConfig;
    }

    @Override
    public UserInfoResponse getCurrentUser() {
        User user = getAuthenticatedUser();
        Collection<GrantedAuthority> authorities = getUserAuthorities(user.getId());

        List<String> roleNames = authorities.stream()
                .map(GrantedAuthority::getAuthority)
                .filter(auth -> auth.startsWith("ROLE_"))
                .map(auth -> auth.substring(5))
                .toList();

        List<String> permissionNames = authorities.stream()
                .map(GrantedAuthority::getAuthority)
                .filter(auth -> !auth.startsWith("ROLE_") && !auth.startsWith("SCOPE_"))
                .toList();

        return new UserInfoResponse(
                user.getId(),
                user.getExternalUserId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getActive(),
                roleNames,
                permissionNames
        );
    }

    @Override
    @Transactional(readOnly = true)
    public User getUserByExternalId(String externalUserId) {
        return userRepository.findByExternalUserId(externalUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "User not found"));
    }

    @Override
    @Transactional(readOnly = true)
    public User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "User not found"));
    }

    @Override
    @Transactional
    public User syncUser(String externalUserId, String email, String firstName, String lastName) {
        try {
            Optional<User> existingOpt = userRepository.findByExternalUserId(externalUserId);

            if (existingOpt.isPresent()) {
                User user = existingOpt.get();
                boolean updated = false;

                if (email != null && !email.equals(user.getEmail())) {
                    user.setEmail(email);
                    updated = true;
                }
                if (firstName != null && !firstName.equals(user.getFirstName())) {
                    user.setFirstName(firstName);
                    updated = true;
                }
                if (lastName != null && !lastName.equals(user.getLastName())) {
                    user.setLastName(lastName);
                    updated = true;
                }

                user.recordLogin();

                if (updated) {
                    log.info("Updated user info for: {}", user.getExternalUserId());
                }

                return userRepository.save(user);
            } else {
                Set<Role> roles = new HashSet<>();
                roleRepository.findByName(DEFAULT_ROLE).ifPresent(roles::add);

                User newUser = User.builder()
                        .externalUserId(externalUserId)
                        .email(email != null ? email : externalUserId + "@placeholder.local")
                        .firstName(firstName)
                        .lastName(lastName)
                        .active(true)
                        .loginCount(1)
                        .roles(roles)
                        .build();
                newUser.recordLogin();

                User saved = userRepository.save(newUser);
                log.info("Created new user from callback: {} ({})", externalUserId, email);
                return saved;
            }
        } catch (DataIntegrityViolationException e) {
            log.warn("Race condition during user sync for {}, fetching existing user", externalUserId);
            return userRepository.findByExternalUserId(externalUserId)
                    .orElseThrow(() -> new IllegalStateException("User should exist after duplicate key error"));
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Collection<GrantedAuthority> getUserAuthorities(Long userId) {
        if (userId == null) {
            return Collections.emptySet();
        }

        Optional<User> userOpt = userRepository.findByIdWithRolesAndPermissions(userId);
        if (userOpt.isEmpty()) {
            return Collections.emptySet();
        }

        User user = userOpt.get();
        Set<GrantedAuthority> authorities = new HashSet<>();

        user.getRoles().stream()
            .filter(role -> Boolean.TRUE.equals(role.getActive()))
            .forEach(role -> authorities.add(new SimpleGrantedAuthority("ROLE_" + role.getName())));

        boolean hasAdminRole = user.getRoles().stream()
            .anyMatch(role -> Boolean.TRUE.equals(role.getActive()) && Boolean.TRUE.equals(role.getIsAdmin()));

        if (hasAdminRole) {
            permissionRepository.findAll().forEach(permission ->
                authorities.add(new SimpleGrantedAuthority(permission.getPermissionString())));
        } else {
            user.getRoles().stream()
                .filter(role -> Boolean.TRUE.equals(role.getActive()))
                .flatMap(role -> role.getPermissions().stream())
                .forEach(permission -> authorities.add(new SimpleGrantedAuthority(permission.getPermissionString())));
        }

        return authorities;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDto getUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        return toUserDto(user);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<UserDto> getUsers(String query, String status, Pageable pageable) {
        Page<User> users;

        boolean hasQuery = query != null && !query.isBlank();
        Boolean activeStatus = parseStatus(status);

        if (hasQuery && activeStatus != null) {
            users = userRepository.searchUsersByStatus(query, activeStatus, pageable);
        } else if (hasQuery) {
            users = userRepository.searchUsers(query, pageable);
        } else if (activeStatus != null) {
            users = activeStatus ? userRepository.findByActiveTrue(pageable) : userRepository.findByActiveFalse(pageable);
        } else {
            users = userRepository.findAll(pageable);
        }

        return users.map(this::toUserDto);
    }

    @Override
    @Transactional
    public UserDto createUser(CreateUserRequest request) {
        String normalizedEmail = request.email().toLowerCase().trim();

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        }

        String externalUserId;
        try {
            externalUserId = userManagementProvider.createUser(
                    normalizedEmail,
                    request.firstName(),
                    request.lastName(),
                    request.temporaryPassword()
            );
        } catch (Exception e) {
            log.error("Failed to create user in identity provider: {}", e.getMessage(), e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create user in identity provider");
        }

        User user = User.builder()
                .externalUserId(externalUserId)
                .email(normalizedEmail)
                .firstName(request.firstName())
                .lastName(request.lastName())
                .active(true)
                .build();

        if (request.roleIds() != null && !request.roleIds().isEmpty()) {
            Set<Role> roles = fetchRolesByIds(request.roleIds());
            user.setRoles(roles);
        }

        user = userRepository.save(user);
        log.info("Created user with id: {} and externalUserId: {}", user.getId(), externalUserId);

        return toUserDto(user);
    }

    @Override
    @Transactional
    public UserDto updateUser(Long id, UpdateUserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (request.firstName() != null) {
            user.setFirstName(request.firstName());
        }
        if (request.lastName() != null) {
            user.setLastName(request.lastName());
        }
        if (request.active() != null && !request.active().equals(user.getActive())) {
            if (!request.active()) {
                Long currentUserId = getCurrentUserId();
                if (currentUserId != null && currentUserId.equals(id)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot deactivate your own account");
                }
            }

            try {
                if (request.active()) {
                    userManagementProvider.enableUser(user.getExternalUserId());
                } else {
                    userManagementProvider.disableUser(user.getExternalUserId());
                }
            } catch (Exception e) {
                log.error("Failed to update user status in identity provider: {}", e.getMessage(), e);
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to update user status in identity provider");
            }

            user.setActive(request.active());
        }

        user = userRepository.save(user);
        log.info("Updated user with id: {}", user.getId());

        return toUserDto(user);
    }

    @Override
    @Transactional
    public void deleteUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Long currentUserId = getCurrentUserId();
        if (currentUserId != null && currentUserId.equals(id)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot delete your own account");
        }

        try {
            userManagementProvider.deleteUser(user.getExternalUserId());
        } catch (Exception e) {
            log.error("Failed to delete user in identity provider: {}", e.getMessage(), e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to delete user in identity provider");
        }

        userRepository.delete(user);
        log.info("Deleted user with id: {}", id);
    }

    @Override
    @Transactional
    public UserDto assignRoles(Long id, AssignRolesRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (request.roleIds() == null || request.roleIds().isEmpty()) {
            user.setRoles(new HashSet<>());
        } else {
            Set<Role> roles = fetchRolesByIds(request.roleIds());
            user.setRoles(roles);
        }

        user = userRepository.save(user);
        log.info("Assigned {} roles to user with id: {}", user.getRoles().size(), user.getId());

        return toUserDto(user);
    }

    @Override
    @Transactional(readOnly = true)
    public List<RoleDto> getAllRoles() {
        return roleRepository.findAll().stream()
                .filter(role -> Boolean.TRUE.equals(role.getActive()))
                .map(this::toRoleDto)
                .toList();
    }

    private Boolean parseStatus(String status) {
        if (status == null || status.isBlank() || "all".equalsIgnoreCase(status)) {
            return null;
        }
        return "active".equalsIgnoreCase(status);
    }

    private Set<Role> fetchRolesByIds(List<Long> roleIds) {
        List<Role> roles = roleRepository.findAllById(roleIds);
        if (roles.size() != roleIds.size()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "One or more roles not found");
        }
        return new HashSet<>(roles);
    }

    private User getAuthenticatedUser() {
        JwtAuthenticationToken authentication = (JwtAuthenticationToken) SecurityContextHolder
                .getContext().getAuthentication();
        Jwt jwt = authentication.getToken();
        AuthProvider provider = authConfig.getProvider(jwt);
        return provider.getUser(jwt);
    }

    private Long getCurrentUserId() {
        return getAuthenticatedUser().getId();
    }

    private UserDto toUserDto(User user) {
        List<RoleDto> roleDtos = user.getRoles().stream()
                .map(this::toRoleDto)
                .toList();

        return new UserDto(
                user.getId(),
                user.getExternalUserId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getActive(),
                roleDtos,
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }

    private RoleDto toRoleDto(Role role) {
        return new RoleDto(
                role.getId(),
                role.getName(),
                role.getDescription(),
                role.getActive()
        );
    }
}
