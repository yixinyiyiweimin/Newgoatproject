const db = require('../utils/db');
const jwt = require('jsonwebtoken');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateOTP, hashOTP, compareOTP } = require('../utils/otp');
const config = require('../config/env');
const { sendOTP } = require('../utils/email');
const auditService = require('./audit.service');

module.exports = {
  /**
   * LOGIN - 11-step flow per BLL.md lines 30-88
   */
  async login(identifier, password, ipAddress) {
    // Step 2: FIND user account
    const user = await db.queryOne(
      `SELECT user_account_id, email, phone_number, password_hash, status, failed_login_attempts
       FROM auth.user_account
       WHERE email = $1 OR phone_number = $1`,
      [identifier]
    );

    // Step 3: CHECK account exists
    if (!user) {
      // Log failed attempt (user not found)
      await db.query(
        `INSERT INTO auth.login_attempt (user_account_id, login_identifier, status, failure_reason, ip_address)
         VALUES (NULL, $1, 'FAILED', 'User not found', $2)`,
        [identifier, ipAddress]
      );
      throw { status: 401, message: 'Invalid credentials' };
    }

    // Step 4: CHECK account status
    if (user.status !== 'ACTIVE') {
      throw { status: 403, message: 'Account is inactive. Please contact admin.' };
    }

    // Step 5: CHECK failed attempts
    if (user.failed_login_attempts >= 5) {
      throw { status: 423, message: 'Account locked. Contact admin.' };
    }

    // Step 6: VERIFY password
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      // Increment failed attempts
      await db.query(
        `UPDATE auth.user_account
         SET failed_login_attempts = failed_login_attempts + 1
         WHERE user_account_id = $1`,
        [user.user_account_id]
      );
      // Log failed attempt
      await db.query(
        `INSERT INTO auth.login_attempt (user_account_id, login_identifier, status, failure_reason, ip_address)
         VALUES ($1, $2, 'FAILED', 'Invalid password', $3)`,
        [user.user_account_id, identifier, ipAddress]
      );
      throw { status: 401, message: 'Invalid credentials' };
    }

    // Step 7: SUCCESS - Reset failed attempts & update last login
    await db.query(
      `UPDATE auth.user_account
       SET failed_login_attempts = 0, last_login_at = NOW()
       WHERE user_account_id = $1`,
      [user.user_account_id]
    );
    await db.query(
      `INSERT INTO auth.login_attempt (user_account_id, login_identifier, status, ip_address)
       VALUES ($1, $2, 'SUCCESS', $3)`,
      [user.user_account_id, identifier, ipAddress]
    );

    // Step 8: FETCH user role & permissions
    const roleData = await db.queryOne(
      `SELECT ur.role_id, r.role_name
       FROM rbac.user_role ur
       JOIN rbac.role r ON r.role_id = ur.role_id
       WHERE ur.user_account_id = $1`,
      [user.user_account_id]
    );

    const permissions = await db.query(
      `SELECT p.module_name, p.action
       FROM rbac.role_permission rp
       JOIN rbac.permission p ON p.permission_id = rp.permission_id
       WHERE rp.role_id = $1`,
      [roleData.role_id]
    );

    // Transform permissions to grouped format
    const permissionsMap = {};
    permissions.forEach((p) => {
      if (!permissionsMap[p.module_name]) {
        permissionsMap[p.module_name] = [];
      }
      permissionsMap[p.module_name].push(p.action);
    });
    const formattedPermissions = Object.keys(permissionsMap).map((module) => ({
      module,
      actions: permissionsMap[module],
    }));

    // Step 9: FETCH user profile
    const profile = await db.queryOne(
      `SELECT * FROM core.user_profile WHERE user_account_id = $1`,
      [user.user_account_id]
    );

    // Step 10: GENERATE JWT token
    const token = jwt.sign(
      {
        user_account_id: user.user_account_id,
        email: user.email,
        role_id: roleData.role_id,
        role_name: roleData.role_name,
        permissions: formattedPermissions,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiry }
    );

    // Step 11: RETURN response
    return {
      token,
      user: {
        user_account_id: user.user_account_id,
        email: user.email,
        full_name: profile?.full_name || '',
        role: roleData.role_name,
        permissions: formattedPermissions,
      },
    };
  },

  /**
   * FORGOT PASSWORD - 5-step flow per BLL.md lines 126-145
   */
  async forgotPassword(email) {
    // Step 1: FIND user
    const user = await db.queryOne(
      `SELECT user_account_id, email FROM auth.user_account WHERE email = $1`,
      [email]
    );

    // If not found, return 200 (security: don't reveal if email exists)
    if (!user) {
      return { message: 'If email exists, OTP has been sent' };
    }

    // Step 2: GENERATE OTP
    const otp = generateOTP();
    const hashedOTP = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Step 3: STORE OTP
    await db.query(
      `INSERT INTO auth.otp (user_account_id, otp_code, purpose, expires_at, is_used)
       VALUES ($1, $2, 'PASSWORD_RESET', $3, false)`,
      [user.user_account_id, hashedOTP, expiresAt]
    );

    // Step 4: SEND OTP via email
    try {
      await sendOTP(user.email, otp);
    } catch (emailErr) {
      console.error(`[OTP] Failed to send email to ${email}:`, emailErr.message);
      // Still log OTP to console as fallback during development
      console.log(`[OTP] Fallback - OTP for ${email}: ${otp}`);
    }

    // Log notification intent
    await db.query(
      `INSERT INTO notify.notification (user_account_id, channel, message_type, status)
       VALUES ($1, 'EMAIL', 'OTP', 'PENDING')`,
      [user.user_account_id]
    );

    // Step 5: RETURN message
    return { message: 'If email exists, OTP has been sent' };
  },

  /**
   * RESET PASSWORD - 9-step flow per BLL.md lines 169-203
   */
  async resetPassword(email, otp, newPassword) {
    // Step 1: FIND user by email
    const user = await db.queryOne(
      `SELECT user_account_id FROM auth.user_account WHERE email = $1`,
      [email]
    );

    if (!user) {
      throw { status: 400, message: 'Invalid request' };
    }

    // Step 2: FIND latest unused OTP for this user
    const otpRecord = await db.queryOne(
      `SELECT otp_id, otp_code, expires_at FROM auth.otp
       WHERE user_account_id = $1 AND purpose = 'PASSWORD_RESET' AND is_used = false
       ORDER BY created_at DESC LIMIT 1`,
      [user.user_account_id]
    );

    if (!otpRecord) {
      throw { status: 400, message: 'Invalid or expired OTP' };
    }

    // Step 3: VALIDATE OTP
    const isOTPValid = await compareOTP(otp, otpRecord.otp_code);
    const isNotExpired = new Date() < new Date(otpRecord.expires_at);

    if (!isOTPValid || !isNotExpired) {
      throw { status: 400, message: 'Invalid or expired OTP' };
    }

    // Step 4: VALIDATE new password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      throw {
        status: 400,
        message:
          'Password must be at least 8 characters and contain uppercase, lowercase, number, and special character',
      };
    }

    // Step 5: HASH new password
    const hashedPassword = await hashPassword(newPassword);

    // Step 6: UPDATE password
    await db.query(
      `UPDATE auth.user_account SET password_hash = $1, failed_login_attempts = 0 WHERE user_account_id = $2`,
      [hashedPassword, user.user_account_id]
    );

    // Step 7: MARK OTP as used
    await db.query(
      `UPDATE auth.otp SET is_used = true WHERE otp_id = $1`,
      [otpRecord.otp_id]
    );

    // Step 8: LOG audit
    await auditService.log(
      user.user_account_id,
      'PASSWORD_RESET',
      'user_account',
      user.user_account_id
    );

    // Step 9: RETURN message
    return { message: 'Password reset successful. You can now login.' };
  },
};
