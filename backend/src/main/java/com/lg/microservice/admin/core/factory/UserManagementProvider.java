package com.lg.microservice.admin.core.factory;

/**
 * Interface for user management operations.
 * This is intentionally separate from AuthProvider because:
 * 1. User management is a distinct concern from authentication
 * 2. Not all auth providers support user management (e.g., SAML IdPs)
 * 3. Follows the same abstraction pattern as AuthProvider
 */
public interface UserManagementProvider {

    /**
     * Create a new user in the identity provider.
     *
     * @param email             User's email address (used as username)
     * @param firstName         User's first name
     * @param lastName          User's last name
     * @param temporaryPassword Optional temporary password. If null, identity provider
     *                          sends an email invitation with auto-generated password.
     *                          If provided, sets this as the temporary password (no email sent).
     * @return The external user ID from the identity provider
     */
    String createUser(String email, String firstName, String lastName, String temporaryPassword);

    /**
     * Delete a user from the identity provider.
     *
     * @param externalUserId The external user ID from the identity provider
     */
    void deleteUser(String externalUserId);

    /**
     * Enable a disabled user in the identity provider.
     *
     * @param externalUserId The external user ID from the identity provider
     */
    void enableUser(String externalUserId);

    /**
     * Disable a user in the identity provider.
     *
     * @param externalUserId The external user ID from the identity provider
     */
    void disableUser(String externalUserId);
}
