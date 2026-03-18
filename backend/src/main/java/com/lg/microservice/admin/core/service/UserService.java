package com.lg.microservice.admin.core.service;

import com.lg.microservice.admin.core.model.dto.AssignRolesRequest;
import com.lg.microservice.admin.core.model.dto.CreateUserRequest;
import com.lg.microservice.admin.core.model.dto.RoleDto;
import com.lg.microservice.admin.core.model.dto.UpdateUserRequest;
import com.lg.microservice.admin.core.model.dto.UserDto;
import com.lg.microservice.admin.core.model.dto.UserInfoResponse;
import com.lg.microservice.admin.core.model.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.GrantedAuthority;

import java.util.Collection;
import java.util.List;

public interface UserService {

    UserInfoResponse getCurrentUser();

    User getUserByExternalId(String externalUserId);

    User getUserByEmail(String email);

    User syncUser(String externalUserId, String email, String firstName, String lastName);

    Collection<GrantedAuthority> getUserAuthorities(Long userId);

    UserDto getUser(Long id);

    Page<UserDto> getUsers(String query, String status, Pageable pageable);

    UserDto createUser(CreateUserRequest request);

    UserDto updateUser(Long id, UpdateUserRequest request);

    void deleteUser(Long id);

    UserDto assignRoles(Long id, AssignRolesRequest request);

    List<RoleDto> getAllRoles();
}
