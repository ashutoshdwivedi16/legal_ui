package com.lg.microservice.admin.common.config;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lg.microservice.admin.core.model.entity.AuditLog;
import com.lg.microservice.admin.core.repository.AuditLogRepository;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Aspect
@Component
public class ProxyAuditAspect {

    private static final Logger log = LoggerFactory.getLogger(ProxyAuditAspect.class);

    private static final String DETAIL_STORAGE_DB = "db";
    private static final String CORRELATION_ID_HEADER = "X-Correlation-ID";

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbcTemplate;

    @Value("${audit.detail-storage:db}")
    private String detailStorage;

    @Value("${spring.jpa.properties.hibernate.default_schema:public}")
    private String schema;

    public ProxyAuditAspect(AuditLogRepository auditLogRepository, ObjectMapper objectMapper, JdbcTemplate jdbcTemplate) {
        this.auditLogRepository = auditLogRepository;
        this.objectMapper = objectMapper;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Pointcut("execution(* com.lg.microservice.admin.domain.*.controller..*(..))")
    public void proxyControllers() {
    }

    @Pointcut("@annotation(org.springframework.web.bind.annotation.PostMapping) || "
            + "@annotation(org.springframework.web.bind.annotation.PutMapping) || "
            + "@annotation(org.springframework.web.bind.annotation.DeleteMapping) || "
            + "@annotation(org.springframework.web.bind.annotation.PatchMapping)")
    public void writeMappings() {
    }

    @Pointcut("proxyControllers() && writeMappings()")
    public void proxyWriteOperations() {
    }

    @Around("proxyWriteOperations()")
    public Object auditProxyWriteOperation(ProceedingJoinPoint joinPoint) throws Throwable {
        AuditLog auditLog = buildBaseAuditLog(joinPoint);
        long startTime = System.currentTimeMillis();

        try {
            Object result = joinPoint.proceed();
            auditLog.setSuccess(true);
            auditLog.setErrorMessage(null);
            addResponseDetails(auditLog, result, System.currentTimeMillis() - startTime);
            saveAuditLog(auditLog);
            return result;
        } catch (Exception ex) {
            auditLog.setSuccess(false);
            auditLog.setErrorMessage(ex.getMessage());
            addResponseDetails(auditLog, null, System.currentTimeMillis() - startTime);
            saveAuditLog(auditLog);
            throw ex;
        }
    }

    private AuditLog buildBaseAuditLog(ProceedingJoinPoint joinPoint) {
        AuditLog auditLog = new AuditLog();
        auditLog.setTimestamp(LocalDateTime.now());
        auditLog.setAction(resolveHttpMethod(joinPoint));
        auditLog.setResourceType("ExternalAPI");
        auditLog.setSuccess(true);

        fillUserContext(auditLog);
        fillRequestContext(auditLog, joinPoint);

        if (DETAIL_STORAGE_DB.equalsIgnoreCase(detailStorage)) {
            Map<String, Object> details = new HashMap<>();
            details.put("request", extractRequestBody(joinPoint));
            auditLog.setDetails(details);
        } else {
            Map<String, Object> logPayload = new HashMap<>();
            logPayload.put("request", extractRequestBody(joinPoint));
            logStructuredAudit(logPayload);
            auditLog.setDetails(null);
        }

        return auditLog;
    }

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
                String email = jdbcTemplate.queryForObject(
                        "SELECT email FROM users WHERE external_user_id = ?",
                        String.class, subject);
                auditLog.setUserEmail(email);
            } catch (Exception e) {
                log.warn("Could not resolve email for subject {}: {}", subject, e.getMessage());
                auditLog.setUserEmail(subject);
            }
        }
    }

    private void fillRequestContext(AuditLog auditLog, ProceedingJoinPoint joinPoint) {
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
        auditLog.setServiceName(extractServiceName(request, joinPoint));
    }

    private void addResponseDetails(AuditLog auditLog, Object response, long durationMs) {
        if (DETAIL_STORAGE_DB.equalsIgnoreCase(detailStorage)) {
            Map<String, Object> details = auditLog.getDetails();
            if (details == null) {
                details = new HashMap<>();
            }
            details.put("response", response);
            details.put("durationMs", durationMs);
            auditLog.setDetails(details);
        } else {
            Map<String, Object> logPayload = new HashMap<>();
            logPayload.put("response", response);
            logPayload.put("durationMs", durationMs);
            logStructuredAudit(logPayload);
        }
    }

    private void saveAuditLog(AuditLog auditLog) {
        try {
            auditLogRepository.save(auditLog);
        } catch (Exception e) {
            log.error("Failed to save proxy audit log", e);
        }
    }

    private String resolveHttpMethod(ProceedingJoinPoint joinPoint) {
        Method method = ((MethodSignature) joinPoint.getSignature()).getMethod();
        if (method.getAnnotation(PostMapping.class) != null) {
            return "POST";
        }
        if (method.getAnnotation(PutMapping.class) != null) {
            return "PUT";
        }
        if (method.getAnnotation(DeleteMapping.class) != null) {
            return "DELETE";
        }
        if (method.getAnnotation(PatchMapping.class) != null) {
            return "PATCH";
        }
        return "UNKNOWN";
    }

    private String extractServiceName(HttpServletRequest request, ProceedingJoinPoint joinPoint) {
        String uri = request.getRequestURI();
        String[] parts = uri.split("/");
        for (int i = 0; i < parts.length; i++) {
            if ("v1".equals(parts[i]) && i + 1 < parts.length) {
                return parts[i + 1];
            }
        }

        Method method = ((MethodSignature) joinPoint.getSignature()).getMethod();
        RequestMapping mapping = method.getDeclaringClass().getAnnotation(RequestMapping.class);
        if (mapping != null && mapping.value().length > 0) {
            String[] mappingParts = mapping.value()[0].split("/");
            for (int i = 0; i < mappingParts.length; i++) {
                if ("v1".equals(mappingParts[i]) && i + 1 < mappingParts.length) {
                    return mappingParts[i + 1];
                }
            }
        }
        return null;
    }

    private Object extractRequestBody(ProceedingJoinPoint joinPoint) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        Object[] args = joinPoint.getArgs();
        Annotation[][] paramAnnotations = method.getParameterAnnotations();

        for (int i = 0; i < args.length; i++) {
            for (Annotation annotation : paramAnnotations[i]) {
                if (annotation instanceof RequestBody) {
                    return args[i];
                }
            }
        }

        for (Object arg : args) {
            if (arg instanceof HttpServletRequest || arg instanceof HttpServletResponse) {
                continue;
            }
            return arg;
        }

        return null;
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
}
