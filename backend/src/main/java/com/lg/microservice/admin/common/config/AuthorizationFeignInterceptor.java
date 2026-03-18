package com.lg.microservice.admin.common.config;

import feign.RequestInterceptor;
import feign.RequestTemplate;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.util.ObjectUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Component
public class AuthorizationFeignInterceptor implements RequestInterceptor {

    private static final Logger log = LoggerFactory.getLogger(AuthorizationFeignInterceptor.class);

    @Override
    public void apply(RequestTemplate template) {
        ServletRequestAttributes servletRequestAttributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (servletRequestAttributes != null) {
            HttpServletRequest request = servletRequestAttributes.getRequest();
            String authorizationHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
            if (!ObjectUtils.isEmpty(authorizationHeader)) {
                template.header(HttpHeaders.AUTHORIZATION, authorizationHeader);
            }
        } else {
            log.debug("No request context available, skipping Authorization header");
        }
    }

}
