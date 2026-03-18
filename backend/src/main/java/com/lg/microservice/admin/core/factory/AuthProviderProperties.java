package com.lg.microservice.admin.core.factory;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "auth.provider")
public class AuthProviderProperties {

    private String type = "cognito";
    private String mode = "hosted";
    private String validationMethod = "jwk";
    private CognitoProperties cognito = new CognitoProperties();
    private MagentoProperties magento = new MagentoProperties();

    @Getter
    @Setter
    public static class MagentoProperties {
        private String publicKey; // RSA PEM public key
    }

    @Getter
    @Setter
    public static class CognitoProperties {
        private String issuerUri;
        private String userPoolId;
        private String clientId;
        private String clientSecret;
        private String domain;
        private String redirectUri;
        private String postLogoutRedirectUri;
        private String publicKey;
    }
}
