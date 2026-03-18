package com.lg.microservice.admin.core.service.impl;

import com.lg.microservice.admin.core.model.dto.AuditLogDto;
import com.lg.microservice.admin.core.model.dto.AuditLogListParams;
import com.lg.microservice.admin.core.model.entity.AuditLog;
import com.lg.microservice.admin.core.repository.AuditLogRepository;
import com.lg.microservice.admin.core.service.AuditLogService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class AuditLogServiceImpl implements AuditLogService {

    private final AuditLogRepository auditLogRepository;

    public AuditLogServiceImpl(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Override
    public Page<AuditLogDto> getAuditLogs(AuditLogListParams params, Pageable pageable) {
        Specification<AuditLog> specification = buildSpecification(params);
        return auditLogRepository.findAll(specification, pageable).map(this::toDto);
    }

    @Override
    public AuditLogDto getAuditLog(Long id) {
        AuditLog auditLog = auditLogRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Audit log not found"));
        return toDto(auditLog);
    }

    @Override
    public List<AuditLogDto> exportAuditLogs(AuditLogListParams params) {
        Specification<AuditLog> specification = buildSpecification(params);
        return auditLogRepository.findAll(specification).stream().map(this::toDto).toList();
    }

    private Specification<AuditLog> buildSpecification(AuditLogListParams params) {
        return (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();

            if (params == null) {
                return cb.conjunction();
            }

            if (params.userId() != null) {
                predicates.add(cb.equal(root.get("userId"), params.userId()));
            }
            if (params.userEmail() != null && !params.userEmail().isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("userEmail")), "%" + params.userEmail().toLowerCase() + "%"));
            }
            if (params.action() != null && !params.action().isBlank()) {
                predicates.add(cb.equal(root.get("action"), params.action()));
            }
            if (params.resourceType() != null && !params.resourceType().isBlank()) {
                predicates.add(cb.equal(root.get("resourceType"), params.resourceType()));
            }
            if (params.serviceName() != null && !params.serviceName().isBlank()) {
                predicates.add(cb.equal(root.get("serviceName"), params.serviceName()));
            }
            if (params.success() != null) {
                predicates.add(cb.equal(root.get("success"), params.success()));
            }
            if (params.startDate() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("timestamp"), params.startDate()));
            }
            if (params.endDate() != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("timestamp"), params.endDate()));
            }

            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    private AuditLogDto toDto(AuditLog auditLog) {
        return new AuditLogDto(
                auditLog.getId(),
                auditLog.getTimestamp(),
                auditLog.getUserId(),
                auditLog.getUserEmail(),
                auditLog.getAction(),
                auditLog.getResourceType(),
                auditLog.getResourceId(),
                auditLog.getDetails(),
                auditLog.getIpAddress(),
                auditLog.getUserAgent(),
                auditLog.getSuccess(),
                auditLog.getErrorMessage(),
                auditLog.getServiceName(),
                auditLog.getEndpoint(),
                auditLog.getHttpMethod(),
                auditLog.getCorrelationId()
        );
    }
}
