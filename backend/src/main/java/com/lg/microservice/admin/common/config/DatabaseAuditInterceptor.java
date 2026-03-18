package com.lg.microservice.admin.common.config;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lg.microservice.admin.core.model.entity.AuditLog;
import com.lg.microservice.admin.core.model.entity.Permission;
import com.lg.microservice.admin.core.model.entity.Role;
import com.lg.microservice.admin.core.model.entity.User;
import org.hibernate.Interceptor;
import org.hibernate.type.Type;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.servlet.http.HttpServletRequest;
import java.io.Serializable;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class DatabaseAuditInterceptor implements Interceptor {

    private static final Logger log = LoggerFactory.getLogger(DatabaseAuditInterceptor.class);

    private static final ThreadLocal<List<AuditLog>> PENDING_LOGS = ThreadLocal.withInitial(ArrayList::new);
    private static final ThreadLocal<Boolean> SYNC_REGISTERED = ThreadLocal.withInitial(() -> false);
    private static final String DETAIL_STORAGE_DB = "db";
    private static final String CORRELATION_ID_HEADER = "X-Correlation-ID";

    private static final String INSERT_SQL = """
            INSERT INTO audit_logs (timestamp, user_email, action, resource_type, resource_id,
                details, ip_address, user_agent, success, endpoint, http_method, correlation_id)
            VALUES (?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?)
            """;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Value("${audit.detail-storage:file}")
    private String detailStorage;

    @Value("${spring.jpa.properties.hibernate.default_schema:public}")
    private String schema;

    public DatabaseAuditInterceptor(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean onSave(Object entity, Object id, Object[] state, String[] propertyNames, Type[] types) {
        if (isAuditableEntity(entity)) {
            log.debug("Audit: CREATE {} id={}", entity.getClass().getSimpleName(), id);
            collectAuditLog("CREATE", entity, id, null, state, propertyNames);
        }
        return false;
    }

    @Override
    public boolean onFlushDirty(Object entity, Object id, Object[] currentState, Object[] previousState, String[] propertyNames, Type[] types) {
        if (isAuditableEntity(entity)) {
            log.debug("Audit: UPDATE {} id={}", entity.getClass().getSimpleName(), id);
            collectAuditLog("UPDATE", entity, id, previousState, currentState, propertyNames);
        }
        return false;
    }

    @Override
    public void onDelete(Object entity, Object id, Object[] state, String[] propertyNames, Type[] types) {
        if (isAuditableEntity(entity)) {
            log.debug("Audit: DELETE {} id={}", entity.getClass().getSimpleName(), id);
            collectAuditLog("DELETE", entity, id, state, null, propertyNames);
        }
    }

    private void collectAuditLog(String action, Object entity, Object id, Object[] beforeState, Object[] afterState, String[] propertyNames) {
        AuditLog auditLog = buildAuditLog(action, entity, id, beforeState, afterState, propertyNames);
        PENDING_LOGS.get().add(auditLog);
        registerSynchronization();
    }

    private void registerSynchronization() {
        if (!SYNC_REGISTERED.get() && TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    List<AuditLog> logs = new ArrayList<>(PENDING_LOGS.get());
                    if (!logs.isEmpty()) {
                        try {
                            for (AuditLog auditLog : logs) {
                                saveViaJdbc(auditLog);
                            }
                        } catch (Exception e) {
                            log.error("Failed to save audit logs", e);
                        }
                    }
                }

                @Override
                public void afterCompletion(int status) {
                    clearThreadLocals();
                }
            });
            SYNC_REGISTERED.set(true);
        }
    }

    private void clearThreadLocals() {
        PENDING_LOGS.get().clear();
        PENDING_LOGS.remove();
        SYNC_REGISTERED.remove();
    }

    private void saveViaJdbc(AuditLog auditLog) {
        String detailsJson = null;
        if (auditLog.getDetails() != null) {
            try {
                detailsJson = objectMapper.writeValueAsString(auditLog.getDetails());
            } catch (JsonProcessingException e) {
                log.warn("Failed to serialize audit log details: {}", e.getMessage());
            }
        }

        jdbcTemplate.execute("SET search_path TO " + schema);
        jdbcTemplate.update(INSERT_SQL,
                Timestamp.valueOf(auditLog.getTimestamp()),
                auditLog.getUserEmail(),
                auditLog.getAction(),
                auditLog.getResourceType(),
                auditLog.getResourceId(),
                detailsJson,
                auditLog.getIpAddress(),
                auditLog.getUserAgent(),
                auditLog.getSuccess(),
                auditLog.getEndpoint(),
                auditLog.getHttpMethod(),
                auditLog.getCorrelationId()
        );
    }

    private AuditLog buildAuditLog(String action, Object entity, Object id, Object[] beforeState, Object[] afterState, String[] propertyNames) {
        AuditLog auditLog = new AuditLog();
        auditLog.setTimestamp(LocalDateTime.now());
        auditLog.setAction(action);
        auditLog.setSuccess(true);

        String resourceType = entity.getClass().getSimpleName();
        auditLog.setResourceType(resourceType);

        if (id instanceof Long) {
            auditLog.setResourceId((Long) id);
        }

        fillUserContext(auditLog);
        fillRequestContext(auditLog);

        Map<String, Object> details = new HashMap<>();
        if (DETAIL_STORAGE_DB.equalsIgnoreCase(detailStorage)) {
            details.put("before", buildStateMap(beforeState, propertyNames));
            details.put("after", buildStateMap(afterState, propertyNames));
            auditLog.setDetails(details);
        } else {
            Map<String, Object> logPayload = new HashMap<>();
            logPayload.put("action", action);
            logPayload.put("resourceType", resourceType);
            logPayload.put("resourceId", auditLog.getResourceId());
            logPayload.put("before", buildStateMap(beforeState, propertyNames));
            logPayload.put("after", buildStateMap(afterState, propertyNames));
            logStructuredAudit(logPayload);
            auditLog.setDetails(null);
        }

        return auditLog;
    }

    private Map<String, Object> buildStateMap(Object[] state, String[] propertyNames) {
        Map<String, Object> map = new HashMap<>();
        if (state == null || propertyNames == null) {
            return map;
        }

        for (int i = 0; i < propertyNames.length; i++) {
            map.put(propertyNames[i], normalizeValue(state[i]));
        }
        return map;
    }

    private Object normalizeValue(Object value) {
        if (value instanceof Serializable serializable) {
            return serializable;
        }
        return value != null ? value.toString() : null;
    }

    private static final String LOOKUP_EMAIL_SQL = "SELECT email FROM users WHERE external_user_id = ?";

    private void fillUserContext(AuditLog auditLog) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String subject = null;

        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            Jwt jwt = jwtAuth.getToken();
            String email = jwt.getClaimAsString("email");
            if (email != null) {
                auditLog.setUserEmail(email);
                return;
            }
            subject = jwt.getSubject();
        } else if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            String email = jwt.getClaimAsString("email");
            if (email != null) {
                auditLog.setUserEmail(email);
                return;
            }
            subject = jwt.getSubject();
        }

        if (subject != null) {
            try {
                jdbcTemplate.execute("SET search_path TO " + schema);
                String email = jdbcTemplate.queryForObject(LOOKUP_EMAIL_SQL, String.class, subject);
                auditLog.setUserEmail(email);
            } catch (Exception e) {
                log.warn("Could not resolve email for subject {}: {}", subject, e.getMessage());
                auditLog.setUserEmail(subject);
            }
        }
    }

    private void fillRequestContext(AuditLog auditLog) {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes == null) {
            return;
        }

        HttpServletRequest request = attributes.getRequest();
        auditLog.setIpAddress(getClientIpAddress(request));
        auditLog.setUserAgent(request.getHeader("User-Agent"));
        auditLog.setEndpoint(request.getRequestURI());
        auditLog.setHttpMethod(request.getMethod());
        auditLog.setCorrelationId(request.getHeader(CORRELATION_ID_HEADER));
    }

    private String getClientIpAddress(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private void logStructuredAudit(Map<String, Object> payload) {
        try {
            log.info("AuditLog: {}", objectMapper.writeValueAsString(payload));
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize audit log payload: {}", e.getMessage());
        }
    }

    private boolean isAuditableEntity(Object entity) {
        return entity instanceof User || entity instanceof Role || entity instanceof Permission;
    }
}
