import { useState, useEffect } from 'react'
import { roleApi } from '../../../utils/api'
import ConfirmDialog from '../../../components/ConfirmDialog'
import './UsersAndRoles.css'

const MODULES = [
  'dashboard', 'vaccine_type', 'breeding_type', 'goat_breed',
  'premise', 'user_registration', 'user_role', 'goat', 'vaccination',
  'health_record', 'breeding_program', 'slaughter',
  'feed_price_calculator', 'feed_calculator', 'rfid_scan',
]
const ACTIONS = ['view', 'create', 'update', 'delete']

function UsersAndRoles() {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Role modal state
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  const [roleForm, setRoleForm] = useState({ role_name: '', permissions: {} })
  const [saving, setSaving] = useState(false)

  // Delete: two-step confirm
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteStep, setDeleteStep] = useState(1)

  // Fetch data
  const fetchData = async () => {
    setLoading(true)
    setError('')
    const rolesRes = await roleApi.getRoles()
    if (rolesRes.status === 200) {
      setRoles(rolesRes.data)
    } else {
      setError('Failed to load roles')
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // ─── Role Modal Handlers ────────────────────────────────

  const openRoleModal = (role = null) => {
    setEditingRole(role)
    if (role) {
      const permMap = {}
      ;(role.permissions || []).forEach((p) => {
        const key = p.module_name
        if (!permMap[key]) permMap[key] = {}
        permMap[key][p.action] = true
      })
      setRoleForm({ role_name: role.role_name, permissions: permMap })
    } else {
      setRoleForm({ role_name: '', permissions: {} })
    }
    setRoleModalOpen(true)
  }

  const togglePermission = (moduleName, action) => {
    setRoleForm((prev) => {
      const perms = { ...prev.permissions }
      if (!perms[moduleName]) perms[moduleName] = {}
      perms[moduleName] = { ...perms[moduleName] }
      perms[moduleName][action] = !perms[moduleName][action]
      return { ...prev, permissions: perms }
    })
  }

  const toggleAllForAction = (action) => {
    setRoleForm((prev) => {
      const perms = { ...prev.permissions }
      const allChecked = MODULES.every((mod) => perms[mod]?.[action])
      MODULES.forEach((mod) => {
        if (!perms[mod]) perms[mod] = {}
        perms[mod] = { ...perms[mod] }
        perms[mod][action] = !allChecked
      })
      return { ...prev, permissions: perms }
    })
  }

  const isAllCheckedForAction = (action) => {
    return MODULES.every((mod) => roleForm.permissions[mod]?.[action])
  }

  const handleSaveRole = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const permissions = []
    Object.entries(roleForm.permissions).forEach(([moduleName, actions]) => {
      const activeActions = Object.entries(actions)
        .filter(([, checked]) => checked)
        .map(([action]) => action)
      if (activeActions.length > 0) {
        permissions.push({ module_name: moduleName, actions: activeActions })
      }
    })

    const payload = { role_name: roleForm.role_name, permissions }

    let response
    if (editingRole) {
      response = await roleApi.updateRole(editingRole.role_id, payload)
    } else {
      response = await roleApi.createRole(payload)
    }

    if (response.status === 200 || response.status === 201) {
      setRoleModalOpen(false)
      fetchData()
    } else {
      setError(response.data?.message || 'Save failed')
    }
    setSaving(false)
  }

  const initiateDeleteRole = (role) => {
    setDeleteTarget(role)
    setDeleteStep(1)
  }

  const handleDeleteRole = async () => {
    if (!deleteTarget) return

    // Step 1: if users assigned, show second warning first
    if (deleteStep === 1 && deleteTarget.user_count > 0) {
      setDeleteStep(2)
      return
    }

    const response = await roleApi.deleteRole(deleteTarget.role_id)
    if (response.status === 200) {
      setDeleteTarget(null)
      setDeleteStep(1)
      fetchData()
    } else {
      setError(response.data?.message || 'Delete failed')
      setDeleteTarget(null)
      setDeleteStep(1)
    }
  }

  const cancelDelete = () => {
    setDeleteTarget(null)
    setDeleteStep(1)
  }

  const getDeleteMessage = () => {
    if (!deleteTarget) return ''
    if (deleteStep === 2) {
      return `${deleteTarget.user_count} user(s) are currently assigned the "${deleteTarget.role_name}" role. They will lose ALL permissions granted by this role. This cannot be undone.`
    }
    return `Are you sure you want to delete the role "${deleteTarget.role_name}"?`
  }

  const getDeleteTitle = () => {
    if (deleteStep === 2) return 'Users Will Be Affected!'
    return 'Delete Role?'
  }

  return (
    <div className="roles-page">
      <div className="roles-header">
        <h1>Roles and Permissions</h1>
        {/* @component @id: A-ROLES-006 @label: Add Role Button */}
        <button className="crud-add-btn" onClick={() => openRoleModal()}>
          + Add Role
        </button>
      </div>

      {error && <div className="crud-error">{error}</div>}

      {loading ? (
        <p className="crud-loading">Loading...</p>
      ) : (
        <>
          {/* @component
           * @id: A-ROLES-004
           * @label: Roles Table
           * @path: /admin/roles
           * @archetype: DISPLAY
           * @trigger: onLoad
           * @api: GET /api/admin/roles
           * @ur_id: 2.1.7
           */}
          <div className="crud-table-wrapper">
            {roles.length === 0 ? (
              <p className="crud-empty">No roles found.</p>
            ) : (
              <table className="crud-table">
                <thead>
                  <tr>
                    <th>Role Name</th>
                    <th>System Role</th>
                    <th>Users</th>
                    <th>Permissions</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.role_id}>
                      <td>{role.role_name}</td>
                      <td>{role.is_system_role ? 'Yes' : 'No'}</td>
                      <td>{role.user_count}</td>
                      <td>{role.permissions?.length || 0} permissions</td>
                      <td className="crud-actions">
                        <button className="crud-edit-btn" onClick={() => openRoleModal(role)}>
                          Edit
                        </button>
                        {!role.is_system_role && (
                          <button className="crud-delete-btn" onClick={() => initiateDeleteRole(role)}>
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ─── Role Form Modal ──────────────────────────── */}
      {roleModalOpen && (
        <div className="crud-modal-overlay" onClick={() => setRoleModalOpen(false)}>
          {/* @component @id: A-ROLES-014 @label: Role Form Modal */}
          <div className="crud-modal role-form-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingRole ? 'Edit Role' : 'Create Role'}</h2>
            <form onSubmit={handleSaveRole}>
              {/* @component @id: A-ROLES-015 @label: Role Name Input */}
              <div className="form-group">
                <label>Role Name *</label>
                <input
                  type="text"
                  value={roleForm.role_name}
                  onChange={(e) => setRoleForm((prev) => ({ ...prev, role_name: e.target.value }))}
                  required
                  disabled={!!editingRole?.is_system_role}
                  placeholder="e.g., Farm Supervisor"
                />
              </div>

              {/* @component
               * @id: A-ROLES-016
               * @label: Module Permissions Grid
               * @path: /admin/roles
               * @archetype: INPUT
               * @trigger: onChange
               * @ur_id: 2.1.7
               * @notes: Checkbox grid per module, has toggle-all per column
               */}
              <div className="permissions-grid">
                <label className="permissions-label">Permissions</label>
                {editingRole?.is_system_role && (
                  <p className="system-role-warning">System role permissions are locked to prevent accidental lockout.</p>
                )}
                <table className="permissions-table">
                  <thead>
                    <tr>
                      <th>Module</th>
                      {ACTIONS.map((a) => (
                        <th key={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</th>
                      ))}
                    </tr>
                    {/* Toggle-all row */}
                    <tr className="toggle-all-row">
                      <td className="module-name toggle-all-label">Select All</td>
                      {ACTIONS.map((action) => (
                        <td key={action} className="perm-cell">
                          <input
                            type="checkbox"
                            checked={isAllCheckedForAction(action)}
                            onChange={() => toggleAllForAction(action)}
                            disabled={!!editingRole?.is_system_role}
                          />
                        </td>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES.map((mod) => (
                      <tr key={mod}>
                        <td className="module-name">{mod.replace(/_/g, ' ')}</td>
                        {ACTIONS.map((action) => (
                          <td key={action} className="perm-cell">
                            <input
                              type="checkbox"
                              checked={!!roleForm.permissions[mod]?.[action]}
                              onChange={() => togglePermission(mod, action)}
                              disabled={!!editingRole?.is_system_role}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="crud-modal-actions">
                <button type="button" className="crud-cancel-btn" onClick={() => setRoleModalOpen(false)}>Cancel</button>
                {/* @component @id: A-ROLES-017 @label: Save Role Button */}
                <button type="submit" className="crud-save-btn" disabled={saving}>
                  {saving ? 'Saving...' : editingRole ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation — two-step */}
      {deleteTarget && (
        <ConfirmDialog
          title={getDeleteTitle()}
          message={getDeleteMessage()}
          confirmLabel={deleteStep === 2 ? 'Delete Anyway' : 'Delete'}
          onConfirm={handleDeleteRole}
          onCancel={cancelDelete}
        />
      )}
    </div>
  )
}

export default UsersAndRoles
