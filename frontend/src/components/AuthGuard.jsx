import { Navigate } from 'react-router-dom'

function AuthGuard({ children, requiredRole }) {
  const token = localStorage.getItem('auth_token')
  const user = JSON.parse(localStorage.getItem('user') || 'null')

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default AuthGuard
