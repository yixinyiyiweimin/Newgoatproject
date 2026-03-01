import { useState, useEffect, useCallback } from 'react'
import { adminUserApi, roleApi, premiseApi } from '../../../utils/api'
import ConfirmDialog from '../../../components/ConfirmDialog'
import './UserRegistration.css'

function UserRegistration() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [premises, setPremises] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [viewingUser, setViewingUser] = useState(null)
  const [activeTab, setActiveTab] = useState('Individual')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [resendTarget, setResendTarget] = useState(null)
  const [showInactive, setShowInactive] = useState(true)

  const emptyForm = {
    user_type: 'Individual',
    full_name: '',
    ic_or_passport: '',
    address: '',
    phone_number: '',
    email: '',
    premise_id: '',
    company_name: '',
    company_registration_no: '',
    person_in_charge: '',
    role_id: '',
  }
  const [formData, setFormData] = useState(emptyForm)

  // Edit modal also needs status
  const [editStatus, setEditStatus] = useState('')
  const [editRoleId, setEditRoleId] = useState('')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    const response = await adminUserApi.getAll(searchTerm)
    if (response.status === 200) {
      setUsers(response.data)
    } else {
      setError(response.data?.message || 'Failed to load users')
    }
    setLoading(false)
  }, [searchTerm])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // Fetch roles and premises for dropdowns
  useEffect(() => {
    roleApi.getRoles().then((res) => {
      if (res.status === 200) setRoles(res.data)
    })
    premiseApi.getDropdown().then((res) => {
      if (res.status === 200) setPremises(res.data)
    })
  }, [])

  // Split users into active and inactive
  const activeUsers = users.filter((u) => u.account_status === 'ACTIVE')
  const inactiveUsers = users.filter((u) => u.account_status !== 'ACTIVE')

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-MY', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  }

  const handleAdd = () => {
    setEditingUser(null)
    setFormData(emptyForm)
    setActiveTab('Individual')
    setModalOpen(true)
  }

  const handleEdit = async (user) => {
    // Fetch full user details including role
    const response = await adminUserApi.getById(user.user_account_id)
    const full = response.status === 200 ? response.data : user

    setEditingUser(full)
    setFormData({
      user_type: full.user_type || 'Individual',
      full_name: full.full_name || '',
      ic_or_passport: full.ic_or_passport || '',
      address: full.address || '',
      phone_number: full.profile_phone || full.account_phone || '',
      email: full.account_email || '',
      premise_id: full.premise_id || '',
      company_name: full.company_name || '',
      company_registration_no: full.company_registration_no || '',
      person_in_charge: '',
      role_id: '',
    })
    setEditRoleId(full.role?.role_id || '')
    setEditStatus(full.account_status || 'ACTIVE')
    setActiveTab(full.user_type || 'Individual')
    setModalOpen(true)
  }

  const handleViewDetails = async (user) => {
    const response = await adminUserApi.getById(user.user_account_id)
    if (response.status === 200) {
      setViewingUser(response.data)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = { ...formData, user_type: activeTab }

    let response
    if (editingUser) {
      const { user_type, ic_or_passport, role_id, ...updateFields } = payload
      // Include premise_id if changed
      if (updateFields.premise_id) {
        updateFields.premise_id = Number(updateFields.premise_id)
      } else {
        delete updateFields.premise_id
      }
      response = await adminUserApi.update(editingUser.user_account_id, updateFields)

      // Update role if changed (including changing to "No Role")
      const currentRoleId = editingUser.role?.role_id || ''
      if (response.status === 200 && String(editRoleId) !== String(currentRoleId)) {
        await roleApi.assignRole(editingUser.user_account_id, editRoleId || null)
      }

      // Update status if changed
      if (response.status === 200 && editStatus && editStatus !== editingUser.account_status) {
        await roleApi.updateUserStatus(editingUser.user_account_id, editStatus)
      }
    } else {
      // Include role_id and premise_id for create if selected
      if (payload.role_id) {
        payload.role_id = Number(payload.role_id)
      } else {
        delete payload.role_id
      }
      if (payload.premise_id) {
        payload.premise_id = Number(payload.premise_id)
      } else {
        delete payload.premise_id
      }
      response = await adminUserApi.create(payload)
    }

    if (response.status === 200 || response.status === 201) {
      setModalOpen(false)
      fetchUsers()
    } else {
      setError(response.data?.message || 'Save failed')
    }
    setSaving(false)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    const response = await adminUserApi.delete(deleteTarget.user_account_id)
    if (response.status === 200) {
      setDeleteTarget(null)
      fetchUsers()
    } else {
      setError(response.data?.message || 'Delete failed')
      setDeleteTarget(null)
    }
  }

  const handleResendConfirm = async () => {
    if (!resendTarget) return
    const response = await adminUserApi.resendCredentials(resendTarget.user_account_id)
    if (response.status === 200) {
      setResendTarget(null)
      alert('Credentials resent to ' + resendTarget.account_email)
    } else {
      setError(response.data?.message || 'Resend failed')
      setResendTarget(null)
    }
  }

  const setField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const getDeleteMessage = (user) => {
    if (user.account_status === 'INACTIVE') {
      return `This will PERMANENTLY remove "${user.full_name || user.account_email}" and all associated data. This action cannot be undone.`
    }
    return `Are you sure you want to deactivate "${user.full_name || user.account_email}"? They will no longer be able to log in.`
  }

  const getDeleteTitle = (user) => {
    return user.account_status === 'INACTIVE' ? 'Permanently Delete User?' : 'Deactivate User?'
  }

  const renderUserTable = (userList, isInactiveSection = false) => (
    <table className="crud-table user-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>IC/Passport</th>
          <th>Email</th>
          <th>Premise</th>
          <th>Role</th>
          <th>Registered</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {userList.map((user) => (
          <tr key={user.user_account_id}>
            <td>{user.full_name || user.company_name || '-'}</td>
            <td className="nowrap">{user.user_type}</td>
            <td className="nowrap">{user.ic_or_passport}</td>
            <td>{user.account_email}</td>
            <td className="nowrap">{user.premise_code || '-'}</td>
            <td className="nowrap">{user.role_name || '-'}</td>
            <td className="crud-date">{formatDate(user.account_created_at)}</td>
            <td>
              <span className={`status-badge ${(user.account_status || '').toLowerCase()}`}>
                {user.account_status}
              </span>
            </td>
            <td className="user-actions">
              {/* @component @id: A-UREG-018 @label: View Details Button */}
              <button className="crud-edit-btn" onClick={() => handleViewDetails(user)}>View</button>
              {/* @component @id: A-UREG-019 @label: Edit Row Button */}
              <button className="crud-edit-btn" onClick={() => handleEdit(user)}>Edit</button>
              {/* @component @id: A-UREG-020 @label: Delete Row Button */}
              <button className="crud-delete-btn" onClick={() => setDeleteTarget(user)}>
                {isInactiveSection ? 'Remove' : 'Delete'}
              </button>
              {/* @component @id: A-UREG-021 @label: Resend Credentials Button */}
              {!isInactiveSection && (
                <button className="crud-edit-btn" onClick={() => setResendTarget(user)}>Resend</button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <div className="user-reg-page">
      {/* Header */}
      <div className="user-reg-header">
        <h1>User Management</h1>
        {/* @component
         * @id: A-UREG-001
         * @label: Add User Button
         * @path: /admin/users
         * @archetype: ACTION
         * @trigger: onClick
         * @ur_id: 2.1.6
         * @notes: Opens modal
         */}
        <button className="crud-add-btn" onClick={handleAdd}>
          + Add User
        </button>
      </div>

      {/* Search */}
      {/* @component
       * @id: A-UREG-003
       * @label: Search Bar
       * @path: /admin/users
       * @archetype: INPUT
       * @trigger: onChange
       * @api: GET /api/admin/users?q=
       * @ur_id: 2.1.6
       */}
      <div className="crud-search">
        <input
          type="text"
          placeholder="Search by name, IC, email, premise..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {error && <div className="crud-error">{error}</div>}

      {/* Active User List Table */}
      {/* @component
       * @id: A-UREG-002
       * @label: User List Table
       * @path: /admin/users
       * @archetype: DISPLAY
       * @trigger: onLoad
       * @api: GET /api/admin/users
       * @ur_id: 2.1.6
       * @notes: No # column, has Registered date, split active/inactive sections
       */}
      <div className="crud-table-wrapper">
        {loading ? (
          <p className="crud-loading">Loading...</p>
        ) : activeUsers.length === 0 ? (
          <p className="crud-empty">No active users found.</p>
        ) : (
          renderUserTable(activeUsers)
        )}
      </div>

      {/* Inactive Users Section */}
      {!loading && inactiveUsers.length > 0 && (
        <div className="inactive-section">
          <button
            className="inactive-toggle-btn"
            onClick={() => setShowInactive(!showInactive)}
            type="button"
          >
            {showInactive ? '▾' : '▸'} Inactive Users ({inactiveUsers.length})
          </button>
          {showInactive && (
            <div className="inactive-table-wrapper">
              {renderUserTable(inactiveUsers, true)}
            </div>
          )}
        </div>
      )}

      {/* View Details Modal */}
      {viewingUser && (
        <div className="crud-modal-overlay" onClick={() => setViewingUser(null)}>
          <div className="crud-modal user-detail-modal" onClick={(e) => e.stopPropagation()}>
            <h2>User Details</h2>
            <div className="detail-grid">
              <div><strong>Type:</strong> {viewingUser.user_type}</div>
              <div><strong>Name:</strong> {viewingUser.full_name || '-'}</div>
              <div><strong>IC/Passport:</strong> {viewingUser.ic_or_passport}</div>
              <div><strong>Email:</strong> {viewingUser.account_email}</div>
              <div><strong>Phone:</strong> {viewingUser.profile_phone || viewingUser.account_phone || '-'}</div>
              <div><strong>Address:</strong> {viewingUser.address || '-'}</div>
              <div><strong>Premise:</strong> {viewingUser.premise_code || '-'}</div>
              <div><strong>Status:</strong> {viewingUser.account_status}</div>
              <div><strong>Registered:</strong> {formatDate(viewingUser.created_at || viewingUser.account_created_at)}</div>
              {viewingUser.company_name && <div><strong>Company:</strong> {viewingUser.company_name}</div>}
              {viewingUser.company_registration_no && <div><strong>Reg No:</strong> {viewingUser.company_registration_no}</div>}
              {viewingUser.role && <div><strong>Role:</strong> {viewingUser.role.role_name}</div>}
            </div>
            <div className="crud-modal-actions">
              <button className="crud-cancel-btn" onClick={() => setViewingUser(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="crud-modal-overlay" onClick={() => setModalOpen(false)}>
          {/* @component
           * @id: A-UREG-004
           * @label: User Registration Form Modal
           * @path: /admin/users
           * @archetype: CONTAINER
           * @trigger: onOpen
           * @ur_id: 2.1.6
           */}
          <div className="crud-modal user-form-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingUser ? 'Edit User' : 'Register New User'}</h2>

            {/* Tabs — only for create */}
            {!editingUser && (
              <div className="user-tabs">
                {/* @component @id: A-UREG-005 @label: Individual Tab */}
                <button
                  className={`tab-btn ${activeTab === 'Individual' ? 'active' : ''}`}
                  onClick={() => setActiveTab('Individual')}
                  type="button"
                >
                  Individual
                </button>
                {/* @component @id: A-UREG-006 @label: Company Tab */}
                <button
                  className={`tab-btn ${activeTab === 'Company' ? 'active' : ''}`}
                  onClick={() => setActiveTab('Company')}
                  type="button"
                >
                  Company
                </button>
              </div>
            )}

            <form onSubmit={handleSave}>
              {/* Shared fields */}
              {/* @component @id: A-UREG-012 @label: Email Input */}
              <div className="form-group">
                <label>Email *</label>
                <input type="email" value={formData.email} onChange={(e) => setField('email', e.target.value)} required disabled={!!editingUser} />
              </div>

              {/* @component @id: A-UREG-008 @label: IC/Passport Input */}
              <div className="form-group">
                <label>IC / Passport *</label>
                <input type="text" value={formData.ic_or_passport} onChange={(e) => setField('ic_or_passport', e.target.value)} required disabled={!!editingUser} />
              </div>

              {activeTab === 'Individual' && (
                <>
                  {/* @component @id: A-UREG-007 @label: Full Name Input */}
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input type="text" value={formData.full_name} onChange={(e) => setField('full_name', e.target.value)} required />
                  </div>
                </>
              )}

              {activeTab === 'Company' && (
                <>
                  {/* @component @id: A-UREG-014 @label: Company Name Input */}
                  <div className="form-group">
                    <label>Company Name *</label>
                    <input type="text" value={formData.company_name} onChange={(e) => setField('company_name', e.target.value)} required />
                  </div>
                  {/* @component @id: A-UREG-015 @label: Company Registration Number Input */}
                  <div className="form-group">
                    <label>Company Reg No *</label>
                    <input type="text" value={formData.company_registration_no} onChange={(e) => setField('company_registration_no', e.target.value)} required />
                  </div>
                  {/* @component @id: A-UREG-016 @label: Person in Charge Input */}
                  <div className="form-group">
                    <label>Person in Charge</label>
                    <input type="text" value={formData.person_in_charge} onChange={(e) => setField('person_in_charge', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input type="text" value={formData.full_name} onChange={(e) => setField('full_name', e.target.value)} />
                  </div>
                </>
              )}

              {/* @component @id: A-UREG-009 @label: Address Input */}
              <div className="form-group">
                <label>Address</label>
                <input type="text" value={formData.address} onChange={(e) => setField('address', e.target.value)} />
              </div>

              {/* @component @id: A-UREG-010 @label: Phone Number Input */}
              <div className="form-group">
                <label>Phone Number</label>
                <input type="text" value={formData.phone_number} onChange={(e) => setField('phone_number', e.target.value)} placeholder="+60123456789" />
              </div>

              {/* @component @id: A-UREG-011 @label: Premise ID Dropdown */}
              <div className="form-group">
                <label>Premise {!editingUser && '*'}</label>
                <select
                  value={formData.premise_id}
                  onChange={(e) => setField('premise_id', e.target.value)}
                  required={!editingUser}
                >
                  <option value="">{editingUser ? '— No change —' : '— Select Premise —'}</option>
                  {premises.map((p) => (
                    <option key={p.premise_id} value={p.premise_id}>
                      {p.premise_code}{p.state ? ` (${p.state}${p.district ? ', ' + p.district : ''})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Role dropdown — both create and edit */}
              <div className="form-group">
                <label>Role</label>
                {editingUser ? (
                  <select
                    value={editRoleId}
                    onChange={(e) => setEditRoleId(Number(e.target.value) || '')}
                  >
                    <option value="">— No Role —</option>
                    {roles.map((r) => (
                      <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={formData.role_id}
                    onChange={(e) => setField('role_id', e.target.value)}
                  >
                    <option value="">Default (Farm Owner)</option>
                    {roles.map((r) => (
                      <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Status select — edit only */}
              {editingUser && (
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              )}

              {/* @component @id: A-UREG-013 @label: Upload Documents Input */}
              <div className="form-group">
                <label>Documents</label>
                <p className="form-hint">Document upload coming soon.</p>
              </div>

              {error && <div className="crud-error">{error}</div>}

              <div className="crud-modal-actions">
                <button type="button" className="crud-cancel-btn" onClick={() => setModalOpen(false)}>Cancel</button>
                {/* @component @id: A-UREG-017 @label: Save User Button */}
                <button type="submit" className="crud-save-btn" disabled={saving}>
                  {saving ? 'Saving...' : editingUser ? 'Update' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title={getDeleteTitle(deleteTarget)}
          message={getDeleteMessage(deleteTarget)}
          confirmLabel={deleteTarget.account_status === 'INACTIVE' ? 'Permanently Delete' : 'Deactivate'}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Resend confirmation */}
      {resendTarget && (
        <ConfirmDialog
          title="Resend Credentials?"
          message={`Resending will generate a new password for "${resendTarget.full_name || resendTarget.account_email}" and invalidate their current password. Continue?`}
          confirmLabel="Resend"
          danger={false}
          onConfirm={handleResendConfirm}
          onCancel={() => setResendTarget(null)}
        />
      )}
    </div>
  )
}

export default UserRegistration
