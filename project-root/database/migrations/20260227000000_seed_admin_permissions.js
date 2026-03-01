/**
 * Seed RBAC permissions, fix roles, and link Super Admin.
 *
 * Fixes 3 critical issues from Cycle 2:
 *
 * Issue 1: Super Admin (role_id=1) has zero permissions → 403 on all pages.
 *   Fix: Link Super Admin to ALL 56 permissions.
 *
 * Issue 2: Only 6 permissions exist (Goat:4, Health:2) with PascalCase naming.
 *   BLL 9B defines 14 modules × 4 actions = 56, all lowercase.
 *   Fix: Rename existing PascalCase → lowercase, insert all 56 permissions.
 *
 * Issue 3: "Farm Owner" role missing (BLL 9A defines 6 roles, DB only has 5+test).
 *   Fix: Insert "Farm Owner" role.
 */

exports.up = function (knex) {
  return knex.raw(`
    -- ============================================================
    -- Issue 2a: Fix existing PascalCase module_names → lowercase
    -- ============================================================
    -- Must update role_permission FK references first (cascade not guaranteed)
    UPDATE rbac.permission SET module_name = 'goat'          WHERE module_name = 'Goat';
    UPDATE rbac.permission SET module_name = 'health_record'  WHERE module_name = 'Health';

    -- ============================================================
    -- Issue 2b: Insert all 56 permissions (14 modules × 4 actions)
    -- BLL Part 9B — all lowercase module_name, UPPERCASE action
    -- ============================================================
    INSERT INTO rbac.permission (module_name, action) VALUES
      -- Admin modules (URS 2.1.x)
      ('dashboard',            'VIEW'),
      ('dashboard',            'CREATE'),
      ('dashboard',            'UPDATE'),
      ('dashboard',            'DELETE'),
      ('vaccine_type',         'VIEW'),
      ('vaccine_type',         'CREATE'),
      ('vaccine_type',         'UPDATE'),
      ('vaccine_type',         'DELETE'),
      ('breeding_type',        'VIEW'),
      ('breeding_type',        'CREATE'),
      ('breeding_type',        'UPDATE'),
      ('breeding_type',        'DELETE'),
      ('goat_breed',           'VIEW'),
      ('goat_breed',           'CREATE'),
      ('goat_breed',           'UPDATE'),
      ('goat_breed',           'DELETE'),
      ('user_registration',    'VIEW'),
      ('user_registration',    'CREATE'),
      ('user_registration',    'UPDATE'),
      ('user_registration',    'DELETE'),
      ('user_role',            'VIEW'),
      ('user_role',            'CREATE'),
      ('user_role',            'UPDATE'),
      ('user_role',            'DELETE'),
      -- User modules (URS 2.2.x)
      ('goat',                 'VIEW'),
      ('goat',                 'CREATE'),
      ('goat',                 'UPDATE'),
      ('goat',                 'DELETE'),
      ('slaughter',            'VIEW'),
      ('slaughter',            'CREATE'),
      ('slaughter',            'UPDATE'),
      ('slaughter',            'DELETE'),
      ('health_record',        'VIEW'),
      ('health_record',        'CREATE'),
      ('health_record',        'UPDATE'),
      ('health_record',        'DELETE'),
      ('vaccination',          'VIEW'),
      ('vaccination',          'CREATE'),
      ('vaccination',          'UPDATE'),
      ('vaccination',          'DELETE'),
      ('breeding_program',     'VIEW'),
      ('breeding_program',     'CREATE'),
      ('breeding_program',     'UPDATE'),
      ('breeding_program',     'DELETE'),
      ('feed_price_calculator','VIEW'),
      ('feed_price_calculator','CREATE'),
      ('feed_price_calculator','UPDATE'),
      ('feed_price_calculator','DELETE'),
      ('feed_calculator',      'VIEW'),
      ('feed_calculator',      'CREATE'),
      ('feed_calculator',      'UPDATE'),
      ('feed_calculator',      'DELETE'),
      ('rfid_scan',            'VIEW'),
      ('rfid_scan',            'CREATE'),
      ('rfid_scan',            'UPDATE'),
      ('rfid_scan',            'DELETE')
    ON CONFLICT DO NOTHING;

    -- ============================================================
    -- Issue 3: Add missing "Farm Owner" role (BLL 9A defines 6 roles)
    -- ============================================================
    INSERT INTO rbac.role (role_name, is_system_role)
    SELECT 'Farm Owner', false
    WHERE NOT EXISTS (
      SELECT 1 FROM rbac.role WHERE role_name = 'Farm Owner'
    );

    -- ============================================================
    -- Issue 1: Link ALL permissions to Super Admin (role_id = 1)
    -- BLL 9C: "Super Admin gets ALL 56 permissions"
    -- ============================================================
    INSERT INTO rbac.role_permission (role_id, permission_id)
    SELECT 1, permission_id FROM rbac.permission
    WHERE NOT EXISTS (
      SELECT 1 FROM rbac.role_permission rp
      WHERE rp.role_id = 1 AND rp.permission_id = rbac.permission.permission_id
    );
  `);
};

exports.down = function (knex) {
  return knex.raw(`
    -- Remove all Super Admin permission links added by this migration
    DELETE FROM rbac.role_permission WHERE role_id = 1;

    -- Remove Farm Owner role (only if no users assigned)
    DELETE FROM rbac.role
    WHERE role_name = 'Farm Owner'
      AND NOT EXISTS (SELECT 1 FROM rbac.user_role WHERE role_id = rbac.role.role_id);

    -- Remove permissions added by this migration (leave goat/health_record)
    DELETE FROM rbac.permission
    WHERE module_name IN (
      'dashboard', 'vaccine_type', 'breeding_type', 'goat_breed',
      'user_registration', 'user_role', 'slaughter', 'vaccination',
      'breeding_program', 'feed_price_calculator', 'feed_calculator', 'rfid_scan'
    );

    -- Restore PascalCase for original rows
    UPDATE rbac.permission SET module_name = 'Goat'   WHERE module_name = 'goat';
    UPDATE rbac.permission SET module_name = 'Health'  WHERE module_name = 'health_record';
  `);
};
