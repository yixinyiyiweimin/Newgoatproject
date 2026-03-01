/**
 * Remove duplicate permission rows.
 *
 * The previous migration renamed PascalCase → lowercase (goat, health_record)
 * then INSERT added new rows for the same module/action combos.
 * This keeps the lower permission_id (original) and removes the duplicate.
 * Also updates any role_permission references to point to the kept row.
 */

exports.up = function (knex) {
  return knex.raw(`
    -- For each duplicate (module_name, action), keep the row with the lowest permission_id.
    -- Re-point any role_permission links from the duplicate to the kept row, then delete duplicates.

    -- Step 1: Update role_permission to point to the kept (min) permission_id
    UPDATE rbac.role_permission rp
    SET permission_id = keeper.min_id
    FROM (
      SELECT module_name, action, MIN(permission_id) AS min_id
      FROM rbac.permission
      GROUP BY module_name, action
      HAVING COUNT(*) > 1
    ) keeper
    JOIN rbac.permission p ON p.module_name = keeper.module_name
                          AND p.action = keeper.action
                          AND p.permission_id != keeper.min_id
    WHERE rp.permission_id = p.permission_id
      AND NOT EXISTS (
        SELECT 1 FROM rbac.role_permission existing
        WHERE existing.role_id = rp.role_id AND existing.permission_id = keeper.min_id
      );

    -- Step 2: Delete orphaned role_permission rows (duplicates that couldn't be re-pointed)
    DELETE FROM rbac.role_permission
    WHERE permission_id IN (
      SELECT p.permission_id
      FROM rbac.permission p
      JOIN (
        SELECT module_name, action, MIN(permission_id) AS min_id
        FROM rbac.permission
        GROUP BY module_name, action
        HAVING COUNT(*) > 1
      ) keeper ON p.module_name = keeper.module_name
             AND p.action = keeper.action
             AND p.permission_id != keeper.min_id
    );

    -- Step 3: Delete the duplicate permission rows
    DELETE FROM rbac.permission
    WHERE permission_id IN (
      SELECT p.permission_id
      FROM rbac.permission p
      JOIN (
        SELECT module_name, action, MIN(permission_id) AS min_id
        FROM rbac.permission
        GROUP BY module_name, action
        HAVING COUNT(*) > 1
      ) keeper ON p.module_name = keeper.module_name
             AND p.action = keeper.action
             AND p.permission_id != keeper.min_id
    );

    -- Step 4: Add unique constraint to prevent future duplicates
    ALTER TABLE rbac.permission
      ADD CONSTRAINT uq_permission_module_action UNIQUE (module_name, action);
  `);
};

exports.down = function (knex) {
  return knex.raw(`
    ALTER TABLE rbac.permission DROP CONSTRAINT IF EXISTS uq_permission_module_action;
  `);
};
