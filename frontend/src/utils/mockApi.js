/**
 * Mock API utility for development
 * Simulates backend responses according to Backend_Business_Logic.md
 * Replace with real axios calls in SESSION 2
 */

// Simulate network delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Mock user database
const mockUsers = [
  {
    user_account_id: 1,
    email: 'farmer1@email.com',
    phone_number: '+60123456789',
    password: 'MyP@ssw0rd', // In real app, this would be hashed
    full_name: 'Ahmad bin Ali',
    role: 'Farm Owner',
    status: 'ACTIVE',
    failed_login_attempts: 0,
    permissions: [
      { module: 'goat', actions: ['view', 'create', 'update', 'delete'] },
      { module: 'vaccination', actions: ['view', 'create'] }
    ]
  },
  {
    user_account_id: 2,
    email: 'admin@email.com',
    phone_number: '+60987654321',
    password: 'Admin@123',
    full_name: 'Admin User',
    role: 'Super Admin',
    status: 'INACTIVE', // Test inactive account
    failed_login_attempts: 0,
    permissions: []
  }
]

// Mock OTP storage
const mockOTPs = {}

export const mockAuthApi = {
  /**
   * POST /api/auth/login
   * Per BLL.md lines 18-91
   */
  async login(identifier, password) {
    await delay(800) // Simulate network delay

    // 1. Validate input
    if (!identifier || !password) {
      return {
        status: 400,
        data: { message: 'Identifier and password are required' }
      }
    }

    // 2. Find user account
    const user = mockUsers.find(
      u => u.email === identifier || u.phone_number === identifier
    )

    // 3. Check account exists
    if (!user) {
      return {
        status: 401,
        data: { message: 'Invalid credentials' }
      }
    }

    // 4. Check account status
    if (user.status !== 'ACTIVE') {
      return {
        status: 403,
        data: { message: 'Account is inactive. Please contact admin.' }
      }
    }

    // 5. Check failed attempts
    if (user.failed_login_attempts >= 5) {
      return {
        status: 423,
        data: { message: 'Account locked. Contact admin.' }
      }
    }

    // 6. Verify password (in mock, just compare plain text)
    if (user.password !== password) {
      user.failed_login_attempts++
      return {
        status: 401,
        data: { message: 'Invalid credentials' }
      }
    }

    // 7-10. Success - Generate mock JWT token
    user.failed_login_attempts = 0
    const token = `mock_jwt_${user.user_account_id}_${Date.now()}`

    return {
      status: 200,
      data: {
        token,
        user: {
          user_account_id: user.user_account_id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          permissions: user.permissions
        }
      }
    }
  },

  /**
   * POST /api/auth/forgot-password
   * Per BLL.md lines 97-128
   */
  async forgotPassword(email) {
    await delay(800)

    // 1. Validate input
    if (!email) {
      return {
        status: 400,
        data: { message: 'Email is required' }
      }
    }

    // 2. Generate OTP (always return 200 for security - don't reveal if email exists)
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    mockOTPs[email] = {
      code: otp,
      expires_at: Date.now() + 10 * 60 * 1000, // 10 minutes
      is_used: false
    }

    console.log(`[MOCK] OTP for ${email}: ${otp}`) // In real app, this would be sent via email

    return {
      status: 200,
      data: { message: 'If email exists, OTP has been sent' }
    }
  },

  /**
   * POST /api/auth/reset-password
   * Per BLL.md lines 131-175
   */
  async resetPassword(email, otp, newPassword) {
    await delay(800)

    // 1. Validate input
    if (!email || !otp || !newPassword) {
      return {
        status: 400,
        data: { message: 'Email, OTP, and new password are required' }
      }
    }

    // 2-3. Validate OTP
    const storedOTP = mockOTPs[email]
    if (!storedOTP || storedOTP.code !== otp || storedOTP.is_used) {
      return {
        status: 400,
        data: { message: 'Invalid or expired OTP' }
      }
    }

    if (Date.now() > storedOTP.expires_at) {
      return {
        status: 400,
        data: { message: 'OTP has expired' }
      }
    }

    // 4. Validate password strength (per URS 2.1.1)
    // Special char = ANY non-alphanumeric symbol (not just limited set)
    // Allows all symbols: ! @ # $ % ^ & * ( ) _ - + = [ ] { } | \ : ; " ' < > , . ? / ~ ` etc.
    // Allows spaces in password
    // No max length restriction
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/
    if (!passwordRegex.test(newPassword)) {
      return {
        status: 400,
        data: {
          message:
            'Password must be at least 8 characters with uppercase, lowercase, number, and special character (any symbol)'
        }
      }
    }

    // 5-7. Update password (in mock, just mark OTP as used)
    storedOTP.is_used = true
    const user = mockUsers.find(u => u.email === email)
    if (user) {
      user.password = newPassword
    }

    return {
      status: 200,
      data: { message: 'Password reset successful. You can now login.' }
    }
  }
}
