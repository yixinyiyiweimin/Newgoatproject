import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import './AdminLayout.css'

/* @component
 * @id: NAV-001
 * @label: Admin/User View Toggle
 * @path: /navigation
 * @archetype: INPUT
 * @trigger: onChange
 * @api:
 * @ur_id:
 * @notes: Admin only, switches view
 */

function AdminLayout() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard' },
    { path: '/admin/vaccine-types', label: 'Vaccine Types' },
    { path: '/admin/breeding-types', label: 'Breeding Types' },
    { path: '/admin/goat-breeds', label: 'Goat Breeds' },
    { path: '/admin/premises', label: 'Premise Management' },
    { path: '/admin/users', label: 'User Management' },
    { path: '/admin/roles', label: 'Roles and Permissions' },
  ]

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <h2>Goat RFID</h2>
          <p className="sidebar-user">{user.full_name || user.email}</p>
          <span className="sidebar-role">{user.role}</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                'nav-link' + (isActive ? ' active' : '')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}

export default AdminLayout
