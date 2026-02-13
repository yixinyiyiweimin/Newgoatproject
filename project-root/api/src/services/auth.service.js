// Authentication business logic
// Per BLL.md MODULE 1: AUTHENTICATION (URS 2.1.1 + 2.2.1)
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { addMinutes } = require('date-fns');
const env = require('../config/env');
const postgrest = require('../utils/postgrest');
const password = require('../utils/password');
const otp = require('../utils/otp');
const audit = require('./audit.service');

// Password validation: min 8, uppercase, lowercase, digit, any special char
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;

// ── 1A. Login ──────────────────────────────────────────────
// BLL.md lines 18-91
async function login(identifier, rawPassword, ipAddress) {
  // 1. Validate input
  const schema = Joi.object({
    identifier: Joi.string().required().trim(),
    password: Joi.string().required()
  });
  const { error } = schema.validate({ identifier, password: rawPassword });
  if (error) {
    return { status: 400, data: { message: error.details[0].message } };
  }

  // 2. Find user account
  const users = await postgrest.get('auth', 'user_account', {
    or: `(email.eq.${identifier},phone_number.eq.${identifier})`,
    select: 'user_account_id,email,phone_number,password_hash,status,failed_login_attempts'
  });

  // 3. Check account exists
  if (!users || users.length === 0) {
    await logLoginAttempt(null, identifier, 'FAILED', 'User not found', ipAddress);
    return { status: 401, data: { message: 'Invalid credentials' } };
  }

  const user = users[0];

  // 4. Check account status
  if (user.status !== 'ACTIVE') {
    return { status: 403, data: { message: 'Account is inactive. Please contact admin.' } };
  }

  // 5. Check failed attempts
  if (user.failed_login_attempts >= 5) {
    return { status: 423, data: { message: 'Account locked. Contact admin.' } };
  }

  // 6. Verify password
  const passwordMatch = await password.compare(rawPassword, user.password_hash);
  if (!passwordMatch) {
    // Increment failed attempts
    await postgrest.update('auth', 'user_account',
      `user_account_id=eq.${user.user_account_id}`,
      { failed_login_attempts: user.failed_login_attempts + 1 }
    );
    await logLoginAttempt(user.user_account_id, identifier, 'FAILED', 'Invalid password', ipAddress);
    return { status: 401, data: { message: 'Invalid credentials' } };
  }

  // 7. Success - Reset failed attempts & update last login
  await postgrest.update('auth', 'user_account',
    `user_account_id=eq.${user.user_account_id}`,
    { failed_login_attempts: 0, last_login_at: new Date().toISOString() }
  );
  await logLoginAttempt(user.user_account_id, identifier, 'SUCCESS', null, ipAddress);

  // 8. Fetch user role & permissions
  const userRoles = await postgrest.get('rbac', 'user_role', {
    user_account_id: `eq.${user.user_account_id}`,
    select: 'role_id'
  });

  let roleName = 'User';
  let permissions = [];

  if (userRoles.length > 0) {
    const roleId = userRoles[0].role_id;

    // Get role name
    const roles = await postgrest.get('rbac', 'role', {
      role_id: `eq.${roleId}`,
      select: 'role_name'
    });
    if (roles.length > 0) roleName = roles[0].role_name;

    // Get role permissions
    const rolePerms = await postgrest.get('rbac', 'role_permission', {
      role_id: `eq.${roleId}`,
      select: 'permission_id'
    });

    if (rolePerms.length > 0) {
      const permIds = rolePerms.map(rp => rp.permission_id).join(',');
      const perms = await postgrest.get('rbac', 'permission', {
        permission_id: `in.(${permIds})`,
        select: 'module_name,action'
      });

      // Group by module
      const moduleMap = {};
      for (const p of perms) {
        if (!moduleMap[p.module_name]) moduleMap[p.module_name] = [];
        moduleMap[p.module_name].push(p.action);
      }
      permissions = Object.entries(moduleMap).map(([module, actions]) => ({ module, actions }));
    }
  }

  // 9. Fetch user profile
  const profiles = await postgrest.get('core', 'user_profile', {
    user_account_id: `eq.${user.user_account_id}`,
    select: '*'
  });
  const profile = profiles[0] || {};

  // 10. Generate JWT
  const tokenPayload = {
    user_account_id: user.user_account_id,
    email: user.email,
    role_id: userRoles[0]?.role_id,
    role_name: roleName,
    permissions
  };
  const token = jwt.sign(tokenPayload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

  // 11. Return response
  return {
    status: 200,
    data: {
      token,
      user: {
        user_account_id: user.user_account_id,
        email: user.email,
        full_name: profile.full_name || user.email,
        role: roleName,
        permissions
      }
    }
  };
}

// ── 1B. Forgot Password ────────────────────────────────────
// BLL.md lines 97-128
async function forgotPassword(email) {
  // 1. Validate input
  if (!email) {
    return { status: 400, data: { message: 'Email is required' } };
  }

  // 2. Find user (return 200 regardless for security)
  const users = await postgrest.get('auth', 'user_account', {
    email: `eq.${email}`,
    select: 'user_account_id,email'
  });

  if (users.length === 0) {
    // Don't reveal if email exists
    return { status: 200, data: { message: 'If email exists, OTP has been sent' } };
  }

  const user = users[0];

  // 3. Generate OTP
  const otpCode = otp.generate();
  const otpHash = await otp.hash(otpCode);
  const expiresAt = addMinutes(new Date(), 10);

  // 4. Store OTP
  await postgrest.create('auth', 'otp', {
    user_account_id: user.user_account_id,
    otp_code: otpHash,
    purpose: 'PASSWORD_RESET',
    expires_at: expiresAt.toISOString(),
    is_used: false
  });

  // 5. Log notification (actual email sending = future implementation)
  await postgrest.create('notify', 'notification', {
    user_account_id: user.user_account_id,
    channel: 'EMAIL',
    message_type: 'OTP',
    status: 'PENDING'
  });

  // Log OTP to console for development/testing
  console.log(`[DEV] OTP for ${email}: ${otpCode}`);

  return { status: 200, data: { message: 'If email exists, OTP has been sent' } };
}

// ── 1C. Reset Password ─────────────────────────────────────
// BLL.md lines 131-175
async function resetPassword(email, otpCode, newPassword) {
  // 1. Validate input
  if (!email || !otpCode || !newPassword) {
    return { status: 400, data: { message: 'Email, OTP, and new password are required' } };
  }

  // 2. Find user by email
  const users = await postgrest.get('auth', 'user_account', {
    email: `eq.${email}`,
    select: 'user_account_id'
  });

  if (users.length === 0) {
    return { status: 400, data: { message: 'Invalid or expired OTP' } };
  }

  const user = users[0];

  // 3. Find latest unused OTP
  const otps = await postgrest.get('auth', 'otp', {
    user_account_id: `eq.${user.user_account_id}`,
    purpose: 'eq.PASSWORD_RESET',
    is_used: 'eq.false',
    order: 'created_at.desc',
    limit: 1
  });

  if (otps.length === 0) {
    return { status: 400, data: { message: 'Invalid or expired OTP' } };
  }

  const storedOtp = otps[0];

  // 4. Validate OTP
  const otpValid = await otp.compare(otpCode, storedOtp.otp_code);
  if (!otpValid) {
    return { status: 400, data: { message: 'Invalid or expired OTP' } };
  }

  // Check expiry
  if (new Date() > new Date(storedOtp.expires_at)) {
    return { status: 400, data: { message: 'OTP has expired' } };
  }

  // 5. Validate new password strength
  if (!PASSWORD_REGEX.test(newPassword)) {
    return {
      status: 400,
      data: {
        message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character (any symbol)'
      }
    };
  }

  // 6. Hash new password
  const hashedPassword = await password.hash(newPassword);

  // 7. Update password
  await postgrest.update('auth', 'user_account',
    `user_account_id=eq.${user.user_account_id}`,
    { password_hash: hashedPassword, failed_login_attempts: 0 }
  );

  // 8. Mark OTP as used
  await postgrest.update('auth', 'otp',
    `otp_id=eq.${storedOtp.otp_id}`,
    { is_used: true }
  );

  // 9. Audit log
  await audit.log({
    actorUserId: user.user_account_id,
    action: 'PASSWORD_RESET',
    entityName: 'user_account',
    entityId: user.user_account_id
  });

  return { status: 200, data: { message: 'Password reset successful. You can now login.' } };
}

// ── Helper: Log login attempt ──────────────────────────────
async function logLoginAttempt(userId, identifier, status, reason, ipAddress) {
  try {
    await postgrest.create('auth', 'login_attempt', {
      user_account_id: userId,
      login_identifier: identifier,
      status,
      failure_reason: reason,
      ip_address: ipAddress
    });
  } catch (err) {
    console.error('[AUTH] Failed to log login attempt:', err.message);
  }
}

module.exports = { login, forgotPassword, resetPassword };
