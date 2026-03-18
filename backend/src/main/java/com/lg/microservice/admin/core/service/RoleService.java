package com.lg.microservice.admin.core.service;

import com.lg.microservice.admin.common.response.DataResponse;
import com.lg.microservice.admin.common.response.PageResponse;
import com.lg.microservice.admin.core.model.dto.CreateRoleRequest;
import com.lg.microservice.admin.core.model.dto.RoleDetailDto;
import com.lg.microservice.admin.core.model.dto.UpdateRoleRequest;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface RoleService {
    PageResponse<RoleDetailDto> getRoles(String name, Pageable pageable);
    DataResponse<RoleDetailDto> getRole(Long id);
    DataResponse<RoleDetailDto> createRole(CreateRoleRequest request);
    DataResponse<RoleDetailDto> updateRole(Long id, UpdateRoleRequest request);
    DataResponse<Void> deleteRole(Long id);
    DataResponse<List<RoleDetailDto>> getActiveRoles();
}
