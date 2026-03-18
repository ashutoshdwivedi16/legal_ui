package com.lg.microservice.admin.core.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PermissionSyncResultDto {
    private Integer added;
    private Integer removed;
    private Integer unchanged;
    private List<PermissionDto> addedPermissions;
    private List<PermissionDto> removedPermissions;
}
