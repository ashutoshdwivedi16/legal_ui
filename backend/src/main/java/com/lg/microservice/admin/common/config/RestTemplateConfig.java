package com.lg.microservice.admin.common.config;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Duration;

@Configuration
public class RestTemplateConfig {

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(30);
    private static final String CORRELATION_ID_HEADER = "X-Correlation-ID";
    private static final String AUTHORIZATION_HEADER = "Authorization";

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(CONNECT_TIMEOUT)
                .setReadTimeout(READ_TIMEOUT)
                .interceptors(correlationIdInterceptor(), authorizationInterceptor())
                .build();
    }

    private ClientHttpRequestInterceptor correlationIdInterceptor() {
        return (request, body, execution) -> {
            ServletRequestAttributes attributes = 
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes != null) {
                String correlationId = attributes.getRequest().getHeader(CORRELATION_ID_HEADER);
                if (correlationId != null) {
                    request.getHeaders().set(CORRELATION_ID_HEADER, correlationId);
                }
            }
            return execution.execute(request, body);
        };
    }

    private ClientHttpRequestInterceptor authorizationInterceptor() {
        return (request, body, execution) -> {
            ServletRequestAttributes attributes = 
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes != null) {
                String authorization = attributes.getRequest().getHeader(AUTHORIZATION_HEADER);
                if (authorization != null) {
                    request.getHeaders().set(AUTHORIZATION_HEADER, authorization);
                }
            }
            return execution.execute(request, body);
        };
    }
}
