package com.lg.microservice.admin.core.factory.provider;

import com.lg.microservice.admin.core.factory.AuthProviderProperties;
import com.lg.microservice.admin.core.factory.UserManagementProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.cognitoidentityprovider.CognitoIdentityProviderClient;
import software.amazon.awssdk.services.cognitoidentityprovider.model.*;

import java.util.List;
import java.util.Locale;

@Slf4j
@Component
public class CognitoUserManagementProvider implements UserManagementProvider {

    private final CognitoIdentityProviderClient cognitoClient;
    private final String userPoolId;

    public CognitoUserManagementProvider(AuthProviderProperties properties) {
        this.userPoolId = properties.getCognito().getUserPoolId();
        
        String issuerUri = properties.getCognito().getIssuerUri();
        Region region = extractRegionFromIssuerUri(issuerUri);
        
        this.cognitoClient = CognitoIdentityProviderClient.builder()
                .region(region)
                .build();
        
        log.info("CognitoUserManagementProvider initialized for user pool: {}", userPoolId);
    }

    @Override
    public String createUser(String email, String firstName, String lastName, String temporaryPassword) {
        String username = email.toLowerCase(Locale.ROOT);
        boolean useManualPassword = temporaryPassword != null && !temporaryPassword.isBlank();
        String externalUserId = null;
        
        try {
            AdminCreateUserRequest.Builder requestBuilder = AdminCreateUserRequest.builder()
                    .userPoolId(userPoolId)
                    .username(username)
                    .userAttributes(
                            AttributeType.builder().name("email").value(email).build(),
                            AttributeType.builder().name("email_verified").value("true").build(),
                            AttributeType.builder().name("given_name").value(firstName).build(),
                            AttributeType.builder().name("family_name").value(lastName).build()
                    );

            if (useManualPassword) {
                requestBuilder.messageAction(MessageActionType.SUPPRESS);
            }

            AdminCreateUserResponse response = cognitoClient.adminCreateUser(requestBuilder.build());
            externalUserId = response.user().username();
            
            if (useManualPassword) {
                try {
                    AdminSetUserPasswordRequest passwordRequest = AdminSetUserPasswordRequest.builder()
                            .userPoolId(userPoolId)
                            .username(externalUserId)
                            .password(temporaryPassword)
                            .permanent(false)
                            .build();
                    cognitoClient.adminSetUserPassword(passwordRequest);
                    log.info("Created Cognito user with manual password: {} with external ID: {}", email, externalUserId);
                } catch (InvalidPasswordException e) {
                    // Password doesn't meet policy - delete the created user and throw
                    log.error("Password does not meet Cognito policy for user: {} - {}", email, e.awsErrorDetails().errorMessage());
                    deleteUserSilently(externalUserId);
                    throw new RuntimeException("Password does not meet requirements: " + e.awsErrorDetails().errorMessage(), e);
                } catch (CognitoIdentityProviderException e) {
                    // Other password-related error - delete the created user and throw
                    log.error("Failed to set password for user: {} - {}", email, e.awsErrorDetails().errorMessage());
                    deleteUserSilently(externalUserId);
                    throw new RuntimeException("Failed to set user password: " + e.awsErrorDetails().errorMessage(), e);
                }
            } else {
                log.info("Created Cognito user with email invitation: {} with external ID: {}", email, externalUserId);
            }
            
            return externalUserId;
            
        } catch (UsernameExistsException e) {
            log.error("User already exists in Cognito: {}", email);
            throw new RuntimeException("User with email " + email + " already exists in Cognito", e);
        } catch (CognitoIdentityProviderException e) {
            log.error("Failed to create user in Cognito: {} - {}", email, e.awsErrorDetails().errorMessage());
            throw new RuntimeException("Failed to create user in Cognito: " + e.awsErrorDetails().errorMessage(), e);
        }
    }
    
    private void deleteUserSilently(String externalUserId) {
        try {
            AdminDeleteUserRequest request = AdminDeleteUserRequest.builder()
                    .userPoolId(userPoolId)
                    .username(externalUserId)
                    .build();
            cognitoClient.adminDeleteUser(request);
            log.info("Rolled back: deleted Cognito user due to password error: {}", externalUserId);
        } catch (Exception rollbackEx) {
            log.error("Failed to rollback Cognito user creation: {}", externalUserId, rollbackEx);
        }
    }

    @Override
    public void deleteUser(String externalUserId) {
        try {
            AdminDeleteUserRequest request = AdminDeleteUserRequest.builder()
                    .userPoolId(userPoolId)
                    .username(externalUserId)
                    .build();

            cognitoClient.adminDeleteUser(request);
            log.info("Deleted Cognito user: {}", externalUserId);
            
        } catch (UserNotFoundException e) {
            log.warn("User not found in Cognito for deletion: {}", externalUserId);
        } catch (CognitoIdentityProviderException e) {
            log.error("Failed to delete user in Cognito: {} - {}", externalUserId, e.awsErrorDetails().errorMessage());
            throw new RuntimeException("Failed to delete user in Cognito: " + e.awsErrorDetails().errorMessage(), e);
        }
    }

    @Override
    public void enableUser(String externalUserId) {
        try {
            AdminEnableUserRequest request = AdminEnableUserRequest.builder()
                    .userPoolId(userPoolId)
                    .username(externalUserId)
                    .build();

            cognitoClient.adminEnableUser(request);
            log.info("Enabled Cognito user: {}", externalUserId);
            
        } catch (UserNotFoundException e) {
            log.error("User not found in Cognito for enabling: {}", externalUserId);
            throw new RuntimeException("User not found in Cognito: " + externalUserId, e);
        } catch (CognitoIdentityProviderException e) {
            log.error("Failed to enable user in Cognito: {} - {}", externalUserId, e.awsErrorDetails().errorMessage());
            throw new RuntimeException("Failed to enable user in Cognito: " + e.awsErrorDetails().errorMessage(), e);
        }
    }

    @Override
    public void disableUser(String externalUserId) {
        try {
            AdminDisableUserRequest request = AdminDisableUserRequest.builder()
                    .userPoolId(userPoolId)
                    .username(externalUserId)
                    .build();

            cognitoClient.adminDisableUser(request);
            log.info("Disabled Cognito user: {}", externalUserId);
            
        } catch (UserNotFoundException e) {
            log.error("User not found in Cognito for disabling: {}", externalUserId);
            throw new RuntimeException("User not found in Cognito: " + externalUserId, e);
        } catch (CognitoIdentityProviderException e) {
            log.error("Failed to disable user in Cognito: {} - {}", externalUserId, e.awsErrorDetails().errorMessage());
            throw new RuntimeException("Failed to disable user in Cognito: " + e.awsErrorDetails().errorMessage(), e);
        }
    }

    private Region extractRegionFromIssuerUri(String issuerUri) {
        if (issuerUri == null || issuerUri.isEmpty()) {
            return Region.US_EAST_1;
        }
        
        try {
            String[] parts = issuerUri.replace("https://", "").split("\\.");
            if (parts.length >= 2 && parts[0].equals("cognito-idp")) {
                return Region.of(parts[1]);
            }
        } catch (Exception e) {
            log.warn("Failed to extract region from issuer URI, defaulting to us-east-1: {}", issuerUri);
        }
        
        return Region.US_EAST_1;
    }
}
