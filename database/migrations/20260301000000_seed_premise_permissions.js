/**
 * Add premise module permissions (view, create, update, delete)
 * and link them to Super Admin role.
 */

exports.up = function (knex) {
  return knex.raw(`
    -- Insert premise permissions
    INSERT INTO rbac.permission (module_name, action) VALUES
      ('premise', 'view'),
      ('premise', 'create'),
      ('premise', 'update'),
      ('premise', 'delete')
    ON CONFLICT DO NOTHING;

    -- Link premise permissions to Super Admin (role_id = 1)
    INSERT INTO rbac.role_permission (role_id, permission_id)
    SELECT 1, permission_id FROM rbac.permission
    WHERE module_name = 'premise'
      AND NOT EXISTS (
        SELECT 1 FROM rbac.role_permission rp
        WHERE rp.role_id = 1 AND rp.permission_id = rbac.permission.permission_id
      );
  `);
};

exports.down = function (knex) {
  return knex.raw(`
    DELETE FROM rbac.role_permission
    WHERE permission_id IN (SELECT permission_id FROM rbac.permission WHERE module_name = 'premise');

    DELETE FROM rbac.permission WHERE module_name = 'premise';
  `);
};
