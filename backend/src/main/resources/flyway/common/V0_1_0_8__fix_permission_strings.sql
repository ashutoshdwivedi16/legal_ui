-- V0_1_0_8__fix_permission_strings.sql
-- Remove 'admin.' prefix from permission strings and resources

UPDATE permissions SET 
    permission_string = REPLACE(permission_string, 'admin.', ''),
    resource = REPLACE(resource, 'admin.', '');
