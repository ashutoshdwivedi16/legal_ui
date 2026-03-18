package com.lg.microservice.admin.common.security;

import com.lg.microservice.admin.core.factory.AuthProvider;
import com.lg.microservice.admin.core.model.entity.User;
import com.lg.microservice.admin.core.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.Collection;

@Component
@RequiredArgsConstructor
public class AppJwtConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final AuthConfig authConfig;
    private final UserService userService;

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        AuthProvider provider = authConfig.getProvider(jwt);
        User user = provider.getUser(jwt);
        Collection<GrantedAuthority> authorities = userService.getUserAuthorities(user.getId());

        String displayName = buildDisplayName(user);
        return new JwtAuthenticationToken(jwt, authorities, displayName);
    }

    private String buildDisplayName(User user) {
        String first = user.getFirstName();
        String last = user.getLastName();

        if (first != null && last != null) {
            return first + " " + last;
        }
        if (first != null) {
            return first;
        }
        if (last != null) {
            return last;
        }
        return user.getEmail();
    }
}
