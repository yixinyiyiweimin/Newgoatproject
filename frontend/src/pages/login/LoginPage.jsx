import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../utils/api'
import './LoginPage.css'

function LoginPage() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await authApi.login(identifier, password)

      if (response.status === 200) {
        // Store token (in real app, use secure storage)
        localStorage.setItem('auth_token', response.data.token)
        localStorage.setItem('user', JSON.stringify(response.data.user))

        // Redirect based on role (per BLL.md requirement)
        if (response.data.user.role === 'Super Admin') {
          navigate('/admin/dashboard')
        } else {
          navigate('/dashboard')
        }
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
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>Goat RFID Management System</h1>
          <p>Login to continue</p>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          {/* @component
           * @id: LOGIN-001
           * @label: Email or Phone Input
           * @path: /login
           * @archetype: INPUT
           * @trigger: onChange
           * @api:
           * @ur_id: 2.1.1/2.2.1
           * @notes: Login identifier
           */}
          <div className="form-group">
            <label htmlFor="identifier">Email or Phone Number</label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="farmer1@email.com or +60123456789"
              required
              autoComplete="username"
            />
          </div>

          {/* @component
           * @id: LOGIN-002
           * @label: Password Input
           * @path: /login
           * @archetype: INPUT
           * @trigger: onChange
           * @api:
           * @ur_id: 2.1.1/2.2.1
           * @notes:
           */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* @component
           * @id: LOGIN-005
           * @label: Login Error Message
           * @path: /login
           * @archetype: DISPLAY
           * @trigger: onError
           * @api:
           * @ur_id: 2.1.1/2.2.1
           * @notes: Invalid credentials
           */}
          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}

          {/* @component
           * @id: LOGIN-003
           * @label: Login Button
           * @path: /login
           * @archetype: ACTION
           * @trigger: onClick
           * @api: POST /api/auth/login
           * @ur_id: 2.1.1/2.2.1
           * @links_to: /dashboard
           * @notes: Redirects based on role
           */}
          <button
            type="submit"
            className="login-button"
            disabled={loading || !identifier || !password}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          {/* @component
           * @id: LOGIN-004
           * @label: Forgot Password Link
           * @path: /login
           * @archetype: ACTION
           * @trigger: onClick
           * @api:
           * @ur_id: 2.1.1/2.2.1
           * @links_to: /forgot-password
           * @notes:
           */}
          <button
            type="button"
            className="forgot-password-link"
            onClick={() => navigate('/forgot-password')}
          >
            Forgot Password?
          </button>
        </form>

        <div className="login-footer">
          <p>Test Accounts:</p>
          <ul>
            <li>
              <strong>Active User:</strong> farmer1@email.com / MyP@ssw0rd
            </li>
            <li>
              <strong>Inactive User:</strong> admin@email.com / Admin@123 (will
              fail with 403)
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
