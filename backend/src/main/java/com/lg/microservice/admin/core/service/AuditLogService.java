package com.lg.microservice.admin.core.service;

import com.lg.microservice.admin.core.model.dto.AuditLogDto;
import com.lg.microservice.admin.core.model.dto.AuditLogListParams;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface AuditLogService {
    Page<AuditLogDto> getAuditLogs(AuditLogListParams params, Pageable pageable);
    AuditLogDto getAuditLog(Long id);
    List<AuditLogDto> exportAuditLogs(AuditLogListParams params);
}
