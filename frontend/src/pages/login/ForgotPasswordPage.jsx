import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../utils/api'
import './ForgotPasswordPage.css'

function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: Enter email, 2: Enter OTP & new password
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSendOTP = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const response = await authApi.forgotPassword(email)

      if (response.status === 200) {
        setMessage(response.data.message)
        setStep(2)
      } else {
        setError(response.data.message)
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    // Frontend validation
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (otp.length !== 6) {
      setError('OTP must be 6 digits')
      return
    }

    setLoading(true)

    try {
      const response = await authApi.resetPassword(email, otp, newPassword)

      if (response.status === 200) {
        setMessage(response.data.message)
        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate('/login')
        }, 2000)
      } else {
        setError(response.data.message)
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="forgot-password-page">
      <div className="forgot-password-container">
        <div className="forgot-password-header">
          <h1>Reset Password</h1>
          <p>
            {step === 1
              ? 'Enter your email to receive OTP'
              : 'Enter OTP and new password'}
          </p>
        </div>

        {step === 1 ? (
          <form className="forgot-password-form" onSubmit={handleSendOTP}>
            {/* @component
             * @id: FORGOT-001
             * @label: Email Input
             * @path: /forgot-password
             * @archetype: INPUT
             * @trigger: onChange
             * @api:
             * @ur_id: 2.1.1
             * @notes:
             */}
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                autoComplete="email"
              />
            </div>

            {message && (
              <div className="success-message" role="status">
                {message}
              </div>
            )}

            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}

            {/* @component
             * @id: FORGOT-002
             * @label: Send OTP Button
             * @path: /forgot-password
             * @archetype: ACTION
             * @trigger: onClick
             * @api: POST /api/auth/forgot-password
             * @ur_id: 2.1.1
             * @notes:
             */}
            <button
              type="submit"
              className="send-otp-button"
              disabled={loading || !email}
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>

            <button
              type="button"
              className="back-to-login-link"
              onClick={() => navigate('/login')}
            >
              Back to Login
            </button>
          </form>
        ) : (
          <form className="forgot-password-form" onSubmit={handleResetPassword}>
            {/* @component
             * @id: FORGOT-003
             * @label: OTP Input
             * @path: /forgot-password
             * @archetype: INPUT
             * @trigger: onChange
             * @api:
             * @ur_id: 2.1.1
             * @notes: 6 digits
             */}
            <div className="form-group">
              <label htmlFor="otp">OTP Code</label>
              <input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setOtp(value)
                }}
                placeholder="Enter 6-digit OTP"
                required
                maxLength={6}
                pattern="\d{6}"
                autoComplete="one-time-code"
              />
              <small className="input-hint">
                Check your email for the 6-digit code
              </small>
            </div>

            {/* @component
             * @id: FORGOT-005
             * @label: New Password Input
             * @path: /forgot-password
             * @archetype: INPUT
             * @trigger: onChange
             * @api:
             * @ur_id: 2.1.1
             * @notes: Min 8 chars, mixed case, number, special
             */}
            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <small className="input-hint">
                Min 8 characters with uppercase, lowercase, number, and special
                character
              </small>
            </div>

            {/* @component
             * @id: FORGOT-006
             * @label: Confirm Password Input
             * @path: /forgot-password
             * @archetype: INPUT
             * @trigger: onChange
             * @api:
             * @ur_id: 2.1.1
             * @notes: Must match
             */}
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            {message && (
              <div className="success-message" role="status">
                {message}
              </div>
            )}

            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}

            {/* @component
             * @id: FORGOT-007
             * @label: Reset Password Button
             * @path: /forgot-password
             * @archetype: ACTION
             * @trigger: onClick
             * @api: POST /api/auth/reset-password
             * @ur_id: 2.1.1
             * @links_to: /login
             * @notes:
             */}
            <button
              type="submit"
              className="reset-password-button"
              disabled={
                loading || !otp || !newPassword || !confirmPassword
              }
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>

            {/* @component
             * @id: FORGOT-004
             * @label: Verify OTP Button
             * @path: /forgot-password
             * @archetype: ACTION
             * @trigger: onClick
             * @api:
             * @ur_id: 2.1.1
             * @notes: Frontend validation
             */}
            <button
              type="button"
              className="back-to-email-link"
              onClick={() => {
                setStep(1)
                setOtp('')
                setNewPassword('')
                setConfirmPassword('')
                setError('')
                setMessage('')
              }}
            >
              Use Different Email
            </button>
          </form>
        )}

        <div className="forgot-password-footer">
          <p>
            <strong>For Testing:</strong>
          </p>
          <ul>
            <li>Use any email to generate OTP</li>
            <li>Check browser console for OTP code</li>
            <li>OTP expires in 10 minutes</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default ForgotPasswordPage
