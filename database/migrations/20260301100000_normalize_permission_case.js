/**
 * Normalize rbac.permission actions to lowercase.
 *
 * Issue: Seed migration inserted UPPERCASE actions (VIEW, CREATE, etc.)
 * but the Roles page frontend sends lowercase, causing duplicates.
 *
 * Fix: Delete UPPERCASE permission rows after re-pointing FKs to lowercase.
 */

exports.up = async function (knex) {
  // Step 1: For each UPPERCASE permission that has a lowercase duplicate,
  // delete the role_permission links pointing to the UPPERCASE version
  // (the lowercase links already exist from when the user saved via the UI)
  await knex.raw(`
    DELETE FROM rbac.role_permission
    WHERE permission_id IN (
      SELECT up.permission_id
      FROM rbac.permission up
      WHERE up.action != LOWER(up.action)
        AND EXISTS (
          SELECT 1 FROM rbac.permission lp
          WHERE lp.module_name = up.module_name
            AND lp.action = LOWER(up.action)
            AND lp.permission_id != up.permission_id
        )
    )
  `);

  // Step 2: For UPPERCASE permissions WITHOUT a lowercase duplicate, just rename to lowercase
  await knex.raw(`
    UPDATE rbac.permission
    SET action = LOWER(action)
    WHERE action != LOWER(action)
      AND NOT EXISTS (
        SELECT 1 FROM rbac.permission p2
        WHERE p2.module_name = rbac.permission.module_name
          AND p2.action = LOWER(rbac.permission.action)
          AND p2.permission_id != rbac.permission.permission_id
      )
  `);

  // Step 3: Delete remaining UPPERCASE duplicates (FKs already cleaned up in step 1)
  await knex.raw(`
    DELETE FROM rbac.permission
    WHERE action != LOWER(action)
  `);

  // Step 4: Re-link Super Admin (role_id=1) to ALL permissions
  await knex.raw(`
    INSERT INTO rbac.role_permission (role_id, permission_id)
    SELECT 1, permission_id FROM rbac.permission
    WHERE NOT EXISTS (
      SELECT 1 FROM rbac.role_permission rp
      WHERE rp.role_id = 1 AND rp.permission_id = rbac.permission.permission_id
    )
  `);
};

exports.down = function (knex) {
  return knex.raw('SELECT 1');
};
