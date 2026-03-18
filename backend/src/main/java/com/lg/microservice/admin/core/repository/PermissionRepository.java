package com.lg.microservice.admin.core.repository;

import com.lg.microservice.admin.core.model.entity.Permission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PermissionRepository extends JpaRepository<Permission, Long> {
    Optional<Permission> findByResourceAndAction(String resource, String action);
    List<Permission> findAllByOrderByResourceAscActionAsc();
    boolean existsByResourceAndAction(String resource, String action);
    Optional<Permission> findByPermissionString(String permissionString);
}
