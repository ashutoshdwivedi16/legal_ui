package com.lg.microservice.admin.core.service;

import com.lg.microservice.admin.common.response.DataResponse;
import com.lg.microservice.admin.core.model.dto.PermissionDto;
import com.lg.microservice.admin.core.model.dto.PermissionSyncResultDto;
import com.lg.microservice.admin.core.model.dto.PermissionTreeDto;

import java.util.List;

public interface PermissionService {
    DataResponse<List<PermissionTreeDto>> getPermissionTree();
    DataResponse<List<PermissionDto>> getAllPermissions();
    DataResponse<PermissionSyncResultDto> syncPermissions();
}
