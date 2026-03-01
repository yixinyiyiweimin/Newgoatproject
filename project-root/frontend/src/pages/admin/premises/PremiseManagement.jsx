import { useState, useEffect, useCallback } from 'react'
import { premiseApi } from '../../../utils/api'
import ConfirmDialog from '../../../components/ConfirmDialog'
import './PremiseManagement.css'

function PremiseManagement() {
  const [premises, setPremises] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPremise, setEditingPremise] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Archived
  const [showArchived, setShowArchived] = useState(false)
  const [archivedItems, setArchivedItems] = useState([])
  const [archivedLoading, setArchivedLoading] = useState(false)

  const emptyForm = {
    premise_code: '',
    state: '',
    district: '',
    address: '',
  }
  const [formData, setFormData] = useState(emptyForm)

  const fetchPremises = useCallback(async () => {
    setLoading(true)
    setError('')
    const response = await premiseApi.getAll(searchTerm)
    if (response.status === 200) {
      setPremises(response.data)
    } else {
      setError(response.data?.message || 'Failed to load premises')
    }
    setLoading(false)
  }, [searchTerm])

  useEffect(() => { fetchPremises() }, [fetchPremises])

  const fetchArchived = useCallback(async () => {
    setArchivedLoading(true)
    const response = await premiseApi.getArchived(searchTerm)
    if (response.status === 200) {
      setArchivedItems(response.data)
    }
    setArchivedLoading(false)
  }, [searchTerm])

  useEffect(() => {
    if (showArchived) fetchArchived()
  }, [showArchived, fetchArchived])

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-MY', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  }

  const handleAdd = () => {
    setEditingPremise(null)
    setFormData(emptyForm)
    setModalOpen(true)
  }

  const handleEdit = (premise) => {
    setEditingPremise(premise)
    setFormData({
      premise_code: premise.premise_code || '',
      state: premise.state || '',
      district: premise.district || '',
      address: premise.address || '',
    })
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    let response
    if (editingPremise) {
      response = await premiseApi.update(editingPremise.premise_id, formData)
    } else {
      response = await premiseApi.create(formData)
    }

    if (response.status === 200 || response.status === 201) {
      setModalOpen(false)
      fetchPremises()
      if (showArchived) fetchArchived()
    } else {
      setError(response.data?.message || 'Save failed')
    }
    setSaving(false)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    const response = await premiseApi.delete(deleteTarget.premise_id)
    if (response.status === 200) {
      setDeleteTarget(null)
      fetchPremises()
      if (showArchived) fetchArchived()
    } else {
      if (response.status === 409) {
        setError('Cannot archive: ' + (response.data?.message || 'premise is in use'))
      } else {
        setError(response.data?.message || 'Delete failed')
      }
      setDeleteTarget(null)
    }
  }

  const setField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="premise-page">
      {/* Header */}
      <div className="premise-header">
        <h1>Premise Management</h1>
        {/* @component
         * @id: A-PREM-001
         * @label: Add Premise Button
         * @path: /admin/premises
         * @archetype: ACTION
         * @trigger: onClick
         */}
        <button className="crud-add-btn" onClick={handleAdd}>
          + Add Premise
        </button>
      </div>

      {/* Search */}
      {/* @component
       * @id: A-PREM-003
       * @label: Search Bar
       * @path: /admin/premises
       * @archetype: INPUT
       * @trigger: onChange
       * @api: GET /api/admin/premises?search=
       */}
      <div className="crud-search">
        <input
          type="text"
          placeholder="Search by code, state, district..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {error && <div className="crud-error">{error}</div>}

      {/* Premise Table */}
      {/* @component
       * @id: A-PREM-002
       * @label: Premise List Table
       * @path: /admin/premises
       * @archetype: DISPLAY
       * @trigger: onLoad
       * @api: GET /api/admin/premises
       */}
      <div className="crud-table-wrapper">
        {loading ? (
          <p className="crud-loading">Loading...</p>
        ) : premises.length === 0 ? (
          <p className="crud-empty">No premises found.</p>
        ) : (
          <table className="crud-table">
            <thead>
              <tr>
                <th>Premise Code</th>
                <th>State</th>
                <th>District</th>
                <th>Address</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {premises.map((p) => (
                <tr key={p.premise_id}>
                  <td>{p.premise_code}</td>
                  <td>{p.state || '-'}</td>
                  <td>{p.district || '-'}</td>
                  <td>{p.address || '-'}</td>
                  <td className="crud-date">{formatDate(p.created_at)}</td>
                  <td className="crud-actions">
                    {/* @component @id: A-PREM-008 @label: Edit Premise Button */}
                    <button className="crud-edit-btn" onClick={() => handleEdit(p)}>Edit</button>
                    {/* @component @id: A-PREM-009 @label: Archive Premise Button */}
                    <button className="crud-delete-btn" onClick={() => setDeleteTarget(p)}>Archive</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Archived toggle */}
      <div style={{ marginTop: 16 }}>
        {/* @component @id: A-PREM-010 @label: Archived Records Toggle */}
        <button
          className="crud-archive-toggle"
          onClick={() => setShowArchived(!showArchived)}
          type="button"
        >
          {showArchived ? 'Hide Archived' : 'Show Archived'}
        </button>
      </div>

      {showArchived && (
        <div className="crud-archived-section">
          <h3>Archived Premises</h3>
          {archivedLoading ? (
            <p className="crud-loading">Loading archived...</p>
          ) : archivedItems.length === 0 ? (
            <p className="crud-empty">No archived premises.</p>
          ) : (
            <div className="crud-archived-wrapper">
              <table className="crud-table crud-archived-table">
                <thead>
                  <tr>
                    <th>Premise Code</th>
                    <th>State</th>
                    <th>District</th>
                    <th>Address</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedItems.map((p) => (
                    <tr key={p.premise_id}>
                      <td>{p.premise_code}</td>
                      <td>{p.state || '-'}</td>
                      <td>{p.district || '-'}</td>
                      <td>{p.address || '-'}</td>
                      <td className="crud-date">{formatDate(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="crud-modal-overlay" onClick={() => setModalOpen(false)}>
          {/* @component
           * @id: A-PREM-004
           * @label: Premise Form Modal
           * @path: /admin/premises
           * @archetype: CONTAINER
           * @trigger: onOpen
           */}
          <div className="crud-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingPremise ? 'Edit Premise' : 'Add Premise'}</h2>
            <form onSubmit={handleSave}>
              {/* @component @id: A-PREM-005 @label: Premise Code Input */}
              <div className="form-group">
                <label>Premise Code *</label>
                <input
                  type="text"
                  value={formData.premise_code}
                  onChange={(e) => setField('premise_code', e.target.value)}
                  required
                  placeholder="e.g., P001"
                />
              </div>

              <div className="form-row">
                {/* @component @id: A-PREM-006 @label: State Input */}
                <div className="form-group">
                  <label>State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setField('state', e.target.value)}
                    placeholder="e.g., Selangor"
                  />
                </div>
                <div className="form-group">
                  <label>District</label>
                  <input
                    type="text"
                    value={formData.district}
                    onChange={(e) => setField('district', e.target.value)}
                    placeholder="e.g., Petaling"
                  />
                </div>
              </div>

              {/* @component @id: A-PREM-007 @label: Address Input */}
              <div className="form-group">
                <label>Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setField('address', e.target.value)}
                  placeholder="Full address"
                />
              </div>

              {error && <div className="crud-error">{error}</div>}

              <div className="crud-modal-actions">
                <button type="button" className="crud-cancel-btn" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="crud-save-btn" disabled={saving}>
                  {saving ? 'Saving...' : editingPremise ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Archive Premise?"
          message={`This will archive premise "${deleteTarget.premise_code}". Archived premises cannot be assigned to new users but remain in historical data.`}
          confirmLabel="Archive"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

export default PremiseManagement
