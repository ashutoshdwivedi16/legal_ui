package com.lg.microservice.admin.common.config;

import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class HibernateAuditConfig {

    private final DatabaseAuditInterceptor auditInterceptor;

    public HibernateAuditConfig(DatabaseAuditInterceptor auditInterceptor) {
        this.auditInterceptor = auditInterceptor;
    }

    @Bean
    public HibernatePropertiesCustomizer hibernatePropertiesCustomizer() {
        return hibernateProperties -> {
            hibernateProperties.put("hibernate.session_factory.interceptor", auditInterceptor);
        };
    }
}
