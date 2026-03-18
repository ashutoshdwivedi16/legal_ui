package com.lg.microservice.admin.core.service.impl;

import com.lg.microservice.admin.common.response.DataResponse;
import com.lg.microservice.admin.core.model.dto.PermissionDto;
import com.lg.microservice.admin.core.model.dto.PermissionSyncResultDto;
import com.lg.microservice.admin.core.model.dto.PermissionTreeDto;
import com.lg.microservice.admin.core.model.entity.Permission;
import com.lg.microservice.admin.core.repository.PermissionRepository;
import com.lg.microservice.admin.core.service.PermissionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.aop.support.AopUtils;
import org.springframework.context.ApplicationContext;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.RestController;

import java.lang.reflect.Method;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PermissionServiceImpl implements PermissionService {

    private final PermissionRepository permissionRepository;
    private final ApplicationContext applicationContext;

    @Override
    public DataResponse<List<PermissionTreeDto>> getPermissionTree() {
        List<Permission> permissions = permissionRepository.findAllByOrderByResourceAscActionAsc();

        List<PermissionTreeDto> tree = permissions.stream()
            .collect(Collectors.groupingBy(Permission::getResource))
            .entrySet().stream()
            .map(entry -> PermissionTreeDto.builder()
                .resource(entry.getKey())
                .permissions(entry.getValue().stream()
                    .map(this::toPermissionDto)
                    .collect(Collectors.toList()))
                .build())
            .sorted(Comparator.comparing(PermissionTreeDto::getResource))
            .collect(Collectors.toList());

        return DataResponse.of(tree);
    }

    @Override
    public DataResponse<List<PermissionDto>> getAllPermissions() {
        List<Permission> permissions = permissionRepository.findAllByOrderByResourceAscActionAsc();
        List<PermissionDto> dtos = permissions.stream()
            .map(this::toPermissionDto)
            .collect(Collectors.toList());

        return DataResponse.of(dtos);
    }

    @Override
    @Transactional
    public DataResponse<PermissionSyncResultDto> syncPermissions() {
        log.info("Starting permission sync from @PreAuthorize annotations...");

        Set<String> codePermissions = scanPreAuthorizeAnnotations();
        log.info("Found {} permissions in code", codePermissions.size());

        List<Permission> existingPermissions = permissionRepository.findAll();
        Set<String> dbPermissions = existingPermissions.stream()
            .map(Permission::getPermissionString)
            .collect(Collectors.toSet());

        Set<String> toAdd = new HashSet<>(codePermissions);
        toAdd.removeAll(dbPermissions);

        Set<String> toRemove = new HashSet<>(dbPermissions);
        toRemove.removeAll(codePermissions);

        Set<String> unchanged = new HashSet<>(codePermissions);
        unchanged.retainAll(dbPermissions);

        List<Permission> addedPermissions = new ArrayList<>();
        for (String permString : toAdd) {
            String[] parts = permString.split(":");
            if (parts.length == 2) {
                Permission permission = Permission.builder()
                    .resource(parts[0])
                    .action(parts[1])
                    .build();
                permission = permissionRepository.save(permission);
                addedPermissions.add(permission);
                log.info("Added permission: {}", permString);
            }
        }

        List<Permission> removedPermissions = new ArrayList<>();
        for (String permString : toRemove) {
            permissionRepository.findByPermissionString(permString).ifPresent(perm -> {
                removedPermissions.add(perm);
                permissionRepository.delete(perm);
                log.info("Removed permission: {}", permString);
            });
        }

        PermissionSyncResultDto result = PermissionSyncResultDto.builder()
            .added(toAdd.size())
            .removed(toRemove.size())
            .unchanged(unchanged.size())
            .addedPermissions(addedPermissions.stream()
                .map(this::toPermissionDto)
                .collect(Collectors.toList()))
            .removedPermissions(removedPermissions.stream()
                .map(this::toPermissionDto)
                .collect(Collectors.toList()))
            .build();

        log.info("Permission sync completed: {} added, {} removed, {} unchanged",
            result.getAdded(), result.getRemoved(), result.getUnchanged());

        return DataResponse.of(result);
    }

    private Set<String> scanPreAuthorizeAnnotations() {
        Set<String> permissions = new HashSet<>();
        Pattern pattern = Pattern.compile("hasAuthority\\('([^']+)'\\)");

        applicationContext.getBeansWithAnnotation(RestController.class).values().forEach(bean -> {
            Class<?> targetClass = AopUtils.getTargetClass(bean);
            Method[] methods = targetClass.getDeclaredMethods();

            for (Method method : methods) {
                PreAuthorize preAuth = method.getAnnotation(PreAuthorize.class);
                if (preAuth != null) {
                    String expr = preAuth.value();
                    Matcher matcher = pattern.matcher(expr);
                    while (matcher.find()) {
                        String permission = matcher.group(1);
                        permissions.add(permission);
                        log.debug("Found permission '{}' in {}.{}", 
                            permission, targetClass.getSimpleName(), method.getName());
                    }
                }
            }
        });

        return permissions;
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
