const crypto = require('crypto');
const db = require('../utils/db');
const { hashPassword } = require('../utils/password');
const { sendCredentials } = require('../utils/email');
const auditService = require('./audit.service');

module.exports = {
  /**
   * List all users with profile + account + premise info.
   */
  async list(search) {
    let sql = `
      SELECT up.user_profile_id, up.user_account_id, up.user_type, up.full_name,
             up.company_name, up.ic_or_passport, up.company_registration_no,
             up.address, up.email AS profile_email, up.phone_number AS profile_phone,
             ua.email AS account_email, ua.phone_number AS account_phone,
             ua.status AS account_status, ua.created_at AS account_created_at,
             p.premise_id, p.premise_code, p.state AS premise_state,
             p.district AS premise_district, p.address AS premise_address,
             r.role_id, r.role_name
      FROM core.user_profile up
      JOIN auth.user_account ua ON ua.user_account_id = up.user_account_id
      LEFT JOIN core.premise p ON p.premise_id = up.premise_id
      LEFT JOIN rbac.user_role ur ON ur.user_account_id = ua.user_account_id
      LEFT JOIN rbac.role r ON r.role_id = ur.role_id
      WHERE ua.status != 'DELETED'
    `;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (up.full_name ILIKE $1 OR up.ic_or_passport ILIKE $1 OR ua.email ILIKE $1 OR up.company_name ILIKE $1 OR p.premise_code ILIKE $1)`;
    }
    sql += ' ORDER BY up.created_at DESC';
    return db.query(sql, params);
  },

  /**
   * Get single user by user_account_id with all related data.
   */
  async getById(id) {
    const user = await db.queryOne(
      `SELECT up.*, ua.email AS account_email, ua.phone_number AS account_phone,
              ua.status AS account_status,
              p.premise_code, p.state AS premise_state,
              p.district AS premise_district, p.address AS premise_address
       FROM core.user_profile up
       JOIN auth.user_account ua ON ua.user_account_id = up.user_account_id
       LEFT JOIN core.premise p ON p.premise_id = up.premise_id
       WHERE up.user_account_id = $1`,
      [id]
    );
    if (!user) throw { status: 404, message: 'User not found' };

    // Fetch documents
    if (user.user_profile_id) {
      user.documents = await db.query(
        'SELECT * FROM core.user_document WHERE user_profile_id = $1',
        [user.user_profile_id]
      );
    }

    // Fetch role
    const role = await db.queryOne(
      `SELECT r.role_id, r.role_name
       FROM rbac.user_role ur
       JOIN rbac.role r ON r.role_id = ur.role_id
       WHERE ur.user_account_id = $1`,
      [id]
    );
    user.role = role || null;

    return user;
  },

  /**
   * Create a new user — multi-table transaction per BLL.md Module 3.
   */
  async create(data, actorUserId) {
    // 1. Check duplicates
    const emailExists = await db.queryOne(
      'SELECT 1 FROM auth.user_account WHERE email = $1', [data.email]
    );
    if (emailExists) throw { status: 409, message: 'Email already registered' };

    if (data.phone_number) {
      const phoneExists = await db.queryOne(
        'SELECT 1 FROM auth.user_account WHERE phone_number = $1', [data.phone_number]
      );
      if (phoneExists) throw { status: 409, message: 'Phone number already registered' };
    }

    const icExists = await db.queryOne(
      'SELECT 1 FROM core.user_profile WHERE ic_or_passport = $1', [data.ic_or_passport]
    );
    if (icExists) throw { status: 409, message: 'IC/Passport number already registered' };

    // Validate premise_id if provided
    let premiseId = null;
    if (data.premise_id) {
      const premise = await db.queryOne(
        "SELECT premise_id FROM core.premise WHERE premise_id = $1 AND status = 'ACTIVE'",
        [data.premise_id]
      );
      if (!premise) throw { status: 400, message: 'Selected premise not found or inactive' };
      premiseId = premise.premise_id;
    }

    // 2. Generate temp password
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await hashPassword(tempPassword);

    // 3. Transaction
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Step 5: Create user_account
      const { rows: [account] } = await client.query(
        `INSERT INTO auth.user_account (email, phone_number, password_hash, status, full_name, ic_number, address, company_name, company_reg_no)
         VALUES ($1, $2, $3, 'ACTIVE', $4, $5, $6, $7, $8)
         RETURNING user_account_id`,
        [data.email, data.phone_number || null, hashedPassword,
         data.full_name || null, data.ic_or_passport, data.address || null,
         data.company_name || null, data.company_registration_no || null]
      );

      // Step 6: Create user_profile (with existing premise_id)
      const { rows: [profile] } = await client.query(
        `INSERT INTO core.user_profile (user_account_id, user_type, full_name, company_name, ic_or_passport, company_registration_no, address, email, phone_number, premise_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING user_profile_id`,
        [account.user_account_id, data.user_type,
         data.full_name || null, data.company_name || null,
         data.ic_or_passport, data.company_registration_no || null,
         data.address || null, data.email, data.phone_number || null,
         premiseId]
      );

      // Step 9: Assign role — use provided role_id or fall back to Farm Owner
      let assignRoleId = data.role_id;
      if (!assignRoleId) {
        const { rows: [farmerRole] } = await client.query(
          "SELECT role_id FROM rbac.role WHERE role_name = 'Farm Owner' LIMIT 1"
        );
        if (farmerRole) assignRoleId = farmerRole.role_id;
      }
      if (assignRoleId) {
        await client.query(
          'INSERT INTO rbac.user_role (user_account_id, role_id) VALUES ($1, $2)',
          [account.user_account_id, assignRoleId]
        );
      }

      // Step 10: Notification record
      await client.query(
        `INSERT INTO notify.notification (user_account_id, channel, message_type, status)
         VALUES ($1, 'EMAIL', 'CREDENTIALS', 'PENDING')`,
        [account.user_account_id]
      );

      // Step 11: Audit log
      await client.query(
        `INSERT INTO audit.audit_log (actor_user_id, action, entity_name, entity_id, new_value, created_at)
         VALUES ($1, 'CREATE', 'user_registration', $2, $3, NOW())`,
        [actorUserId, String(account.user_account_id),
         JSON.stringify({ email: data.email, user_type: data.user_type, premise_id: premiseId })]
      );

      await client.query('COMMIT');

      // Send credentials via email (outside transaction)
      try {
        await sendCredentials(data.email, tempPassword);
      } catch (emailErr) {
        console.error(`[USER] Failed to send credentials to ${data.email}:`, emailErr.message);
        console.log(`[USER] Fallback - Temp password for ${data.email}: ${tempPassword}`);
      }

      return {
        user_account_id: account.user_account_id,
        email: data.email,
        premise_id: premiseId,
        message: 'User created. Credentials sent.',
      };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  /**
   * Update user profile and/or account fields.
   */
  async update(id, data, actorUserId) {
    const existing = await db.queryOne(
      'SELECT * FROM core.user_profile WHERE user_account_id = $1',
      [id]
    );
    if (!existing) throw { status: 404, message: 'User not found' };

    // Update user_profile fields
    const profileFields = ['full_name', 'company_name', 'address', 'phone_number', 'company_registration_no', 'premise_id'];
    const setClauses = [];
    const params = [];
    profileFields.forEach((field) => {
      if (data[field] !== undefined) {
        params.push(data[field]);
        setClauses.push(`${field} = $${params.length}`);
      }
    });

    if (setClauses.length > 0) {
      params.push(id);
      await db.query(
        `UPDATE core.user_profile SET ${setClauses.join(', ')}, updated_at = NOW()
         WHERE user_account_id = $${params.length}`,
        params
      );
    }

    // Update account email if changed
    if (data.email) {
      await db.query(
        'UPDATE auth.user_account SET email = $1, updated_at = NOW() WHERE user_account_id = $2',
        [data.email, id]
      );
    }

    await auditService.log(actorUserId, 'UPDATE', 'user_registration', String(id), null, data);
    return { message: 'User updated' };
  },

  /**
   * Delete user — soft delete (ACTIVE → INACTIVE) or permanent delete (already INACTIVE).
   */
  async softDelete(id, actorUserId) {
    const account = await db.queryOne(
      'SELECT status FROM auth.user_account WHERE user_account_id = $1',
      [id]
    );
    if (!account) throw { status: 404, message: 'User not found' };

    if (account.status === 'INACTIVE') {
      // Permanent delete — cascade through related tables
      const client = await db.getClient();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM rbac.user_role WHERE user_account_id = $1', [id]);
        await client.query('DELETE FROM notify.notification WHERE user_account_id = $1', [id]);
        const profile = await client.query(
          'SELECT user_profile_id FROM core.user_profile WHERE user_account_id = $1', [id]
        );
        if (profile.rows.length > 0) {
          await client.query(
            'DELETE FROM core.user_document WHERE user_profile_id = $1',
            [profile.rows[0].user_profile_id]
          );
        }
        await client.query('DELETE FROM core.user_profile WHERE user_account_id = $1', [id]);
        await client.query('DELETE FROM auth.user_account WHERE user_account_id = $1', [id]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }

      await auditService.log(
        actorUserId, 'PERMANENT_DELETE', 'user_registration', String(id),
        { status: 'INACTIVE' }, null
      );
      return { message: 'User permanently deleted', permanent: true };
    }

    // Soft delete — set INACTIVE
    await db.query(
      "UPDATE auth.user_account SET status = 'INACTIVE', updated_at = NOW() WHERE user_account_id = $1",
      [id]
    );

    await auditService.log(
      actorUserId, 'DELETE', 'user_registration', String(id),
      { status: account.status }, { status: 'INACTIVE' }
    );
    return { message: 'User deactivated' };
  },

  /**
   * Resend credentials — generate new temp password and send email.
   */
  async resendCredentials(id, actorUserId) {
    const account = await db.queryOne(
      'SELECT user_account_id, email FROM auth.user_account WHERE user_account_id = $1',
      [id]
    );
    if (!account) throw { status: 404, message: 'User not found' };

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await hashPassword(tempPassword);

    await db.query(
      'UPDATE auth.user_account SET password_hash = $1, updated_at = NOW() WHERE user_account_id = $2',
      [hashedPassword, id]
    );

    try {
      await sendCredentials(account.email, tempPassword);
    } catch (emailErr) {
      console.error(`[USER] Failed to resend credentials to ${account.email}:`, emailErr.message);
      console.log(`[USER] Fallback - New temp password for ${account.email}: ${tempPassword}`);
    }

    await auditService.log(actorUserId, 'RESEND_CREDENTIALS', 'user_registration', String(id));
    return { message: 'Credentials resent' };
  },
};
