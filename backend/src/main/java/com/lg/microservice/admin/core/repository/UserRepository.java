package com.lg.microservice.admin.core.repository;

import com.lg.microservice.admin.core.model.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByExternalUserId(String externalUserId);

    @Query("SELECT u FROM User u LEFT JOIN FETCH u.roles r LEFT JOIN FETCH r.permissions WHERE u.externalUserId = :externalUserId")
    Optional<User> findByExternalUserIdWithRolesAndPermissions(@Param("externalUserId") String externalUserId);

    @Query("SELECT u FROM User u LEFT JOIN FETCH u.roles r LEFT JOIN FETCH r.permissions WHERE u.id = :id")
    Optional<User> findByIdWithRolesAndPermissions(@Param("id") Long id);

    Optional<User> findByEmail(String email);

    boolean existsByExternalUserId(String externalUserId);

    boolean existsByEmail(String email);

    Page<User> findByActiveTrue(Pageable pageable);

    Page<User> findByActiveFalse(Pageable pageable);

    @Query("SELECT u FROM User u WHERE " +
           "(LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(u.firstName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(u.lastName) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<User> searchUsers(@Param("query") String query, Pageable pageable);

    @Query("SELECT u FROM User u WHERE u.active = :active AND " +
           "(LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(u.firstName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(u.lastName) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<User> searchUsersByStatus(@Param("query") String query, @Param("active") Boolean active, Pageable pageable);

    long countByActiveTrue();
}
