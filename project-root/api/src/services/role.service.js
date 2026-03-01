const db = require('../utils/db');
const auditService = require('./audit.service');

module.exports = {
  /**
   * List all roles with their permissions.
   */
  async listRoles() {
    const roles = await db.query(
      `SELECT r.role_id, r.role_name, r.is_system_role, r.created_at,
              COALESCE(uc.user_count, 0)::int AS user_count
       FROM rbac.role r
       LEFT JOIN (SELECT role_id, COUNT(*)::int AS user_count FROM rbac.user_role GROUP BY role_id) uc
         ON uc.role_id = r.role_id
       ORDER BY r.role_name`
    );

    for (const role of roles) {
      role.permissions = await db.query(
        `SELECT p.module_name, p.action
         FROM rbac.role_permission rp
         JOIN rbac.permission p ON p.permission_id = rp.permission_id
         WHERE rp.role_id = $1
         ORDER BY p.module_name, p.action`,
        [role.role_id]
      );
    }
    return roles;
  },

  /**
   * List users with their role assignments.
   */
  async listUsers() {
    return db.query(
      `SELECT ua.user_account_id, ua.email, ua.phone_number, ua.status,
              ua.full_name, ua.ic_number,
              r.role_id, r.role_name
       FROM auth.user_account ua
       LEFT JOIN rbac.user_role ur ON ur.user_account_id = ua.user_account_id
       LEFT JOIN rbac.role r ON r.role_id = ur.role_id
       WHERE ua.status != 'DELETED'
       ORDER BY ua.full_name, ua.email`
    );
  },

  /**
   * List all distinct module_name + action combos from rbac.permission.
   */
  async listPermissions() {
    return db.query(
      'SELECT DISTINCT module_name, action FROM rbac.permission ORDER BY module_name, action'
    );
  },

  /**
   * Create a role with permissions — BLL Module 4A.
   */
  async createRole(data, actorUserId) {
    // Check duplicate
    const existing = await db.queryOne(
      'SELECT 1 FROM rbac.role WHERE LOWER(role_name) = LOWER($1)',
      [data.role_name]
    );
    if (existing) throw { status: 409, message: 'Role name already exists' };

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Create role
      const { rows: [role] } = await client.query(
        'INSERT INTO rbac.role (role_name, is_system_role) VALUES ($1, false) RETURNING role_id',
        [data.role_name]
      );

      // For each permission, find or create, then link
      for (const perm of data.permissions || []) {
        for (const action of perm.actions || []) {
          // Find existing permission
          let { rows: [existing] } = await client.query(
            'SELECT permission_id FROM rbac.permission WHERE module_name = $1 AND action = $2',
            [perm.module_name, action]
          );

          if (!existing) {
            const { rows: [created] } = await client.query(
              'INSERT INTO rbac.permission (module_name, action) VALUES ($1, $2) RETURNING permission_id',
              [perm.module_name, action]
            );
            existing = created;
          }

          await client.query(
            'INSERT INTO rbac.role_permission (role_id, permission_id) VALUES ($1, $2)',
            [role.role_id, existing.permission_id]
          );
        }
      }

      await client.query('COMMIT');

      await auditService.log(
        actorUserId, 'CREATE', 'role', String(role.role_id),
        null, { role_name: data.role_name, permissions: data.permissions }
      );

      return { role_id: role.role_id, role_name: data.role_name };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  /**
   * Update role name and/or permissions.
   */
  async updateRole(id, data, actorUserId) {
    const role = await db.queryOne('SELECT * FROM rbac.role WHERE role_id = $1', [id]);
    if (!role) throw { status: 404, message: 'Role not found' };

    // Prevent modifying permissions on system roles (Super Admin softlock protection)
    if (role.is_system_role && data.permissions) {
      throw { status: 403, message: 'Cannot modify permissions of a system role. This protects against accidental lockout.' };
    }

    // Check duplicate name (exclude self)
    if (data.role_name && data.role_name !== role.role_name) {
      const dup = await db.queryOne(
        'SELECT 1 FROM rbac.role WHERE LOWER(role_name) = LOWER($1) AND role_id != $2',
        [data.role_name, id]
      );
      if (dup) throw { status: 409, message: 'Role name already exists' };
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Update name if provided
      if (data.role_name) {
        await client.query(
          'UPDATE rbac.role SET role_name = $1 WHERE role_id = $2',
          [data.role_name, id]
        );
      }

      // Replace permissions if provided
      if (data.permissions) {
        await client.query('DELETE FROM rbac.role_permission WHERE role_id = $1', [id]);

        for (const perm of data.permissions) {
          for (const action of perm.actions || []) {
            let { rows: [existing] } = await client.query(
              'SELECT permission_id FROM rbac.permission WHERE module_name = $1 AND action = $2',
              [perm.module_name, action]
            );
            if (!existing) {
              const { rows: [created] } = await client.query(
                'INSERT INTO rbac.permission (module_name, action) VALUES ($1, $2) RETURNING permission_id',
                [perm.module_name, action]
              );
              existing = created;
            }
            await client.query(
              'INSERT INTO rbac.role_permission (role_id, permission_id) VALUES ($1, $2)',
              [id, existing.permission_id]
            );
          }
        }
      }

      await client.query('COMMIT');
      await auditService.log(actorUserId, 'UPDATE', 'role', String(id), null, data);
      return { message: 'Role updated' };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  /**
   * Delete role — auto-unassigns users first, then removes role + permissions.
   */
  async deleteRole(id, actorUserId) {
    const role = await db.queryOne('SELECT * FROM rbac.role WHERE role_id = $1', [id]);
    if (!role) throw { status: 404, message: 'Role not found' };

    if (role.is_system_role) {
      throw { status: 403, message: 'Cannot delete system role' };
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Count and unassign users
      const { rows: [{ count }] } = await client.query(
        'SELECT COUNT(*)::int AS count FROM rbac.user_role WHERE role_id = $1', [id]
      );
      await client.query('DELETE FROM rbac.user_role WHERE role_id = $1', [id]);
      await client.query('DELETE FROM rbac.role_permission WHERE role_id = $1', [id]);
      await client.query('DELETE FROM rbac.role WHERE role_id = $1', [id]);

      await client.query('COMMIT');

      await auditService.log(actorUserId, 'DELETE', 'role', String(id), null,
        { role_name: role.role_name, unassigned_users: count });

      return { message: 'Role deleted', unassigned_users: count };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  /**
   * Assign role to a user (replace existing).
   */
  async assignRole(userAccountId, roleId, actorUserId) {
    await db.query('DELETE FROM rbac.user_role WHERE user_account_id = $1', [userAccountId]);

    if (roleId) {
      await db.query(
        'INSERT INTO rbac.user_role (user_account_id, role_id) VALUES ($1, $2)',
        [userAccountId, roleId]
      );
    }

    await auditService.log(
      actorUserId, roleId ? 'ASSIGN_ROLE' : 'UNASSIGN_ROLE', 'user_role',
      String(userAccountId), null, { role_id: roleId }
    );
    return { message: roleId ? 'Role assigned' : 'Role removed' };
  },

  /**
   * Update user account status (Active/Inactive).
   */
  async updateUserStatus(userAccountId, status, actorUserId) {
    const old = await db.queryOne(
      'SELECT status FROM auth.user_account WHERE user_account_id = $1',
      [userAccountId]
    );
    if (!old) throw { status: 404, message: 'User not found' };

    await db.query(
      'UPDATE auth.user_account SET status = $1, updated_at = NOW() WHERE user_account_id = $2',
      [status, userAccountId]
    );
    await auditService.log(
      actorUserId, 'UPDATE_STATUS', 'user_account',
      String(userAccountId), { status: old.status }, { status }
    );
    return { message: 'User status updated' };
  },
};
