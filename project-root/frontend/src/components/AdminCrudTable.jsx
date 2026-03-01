import { useState, useEffect, useCallback } from 'react'
import ConfirmDialog from './ConfirmDialog'
import './AdminCrudTable.css'

/**
 * Reusable CRUD table for admin reference data pages.
 *
 * Props:
 * - title: string — page heading
 * - columns: Array<{ key, label }> — table columns to display
 * - formFields: Array<{ key, label, type, required, placeholder }> — modal form fields
 * - api: { getAll, getArchived?, create, update, delete } — API methods from api.js
 * - idField: string — primary key column name
 * - componentIds: { addButton, table, searchBar, editButton, deleteButton, modal, saveButton, cancelButton, inputs: { [key]: id } }
 * - pagePath: string — for @component tags
 * - urId: string — URS reference
 * - showCreatedAt: boolean — show created_at date column (default false)
 */
function AdminCrudTable({ title, columns, formFields, api, idField, componentIds, pagePath, urId, showCreatedAt = false }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  const [archivedItems, setArchivedItems] = useState([])
  const [archivedLoading, setArchivedLoading] = useState(false)

  // Build empty form data from formFields
  const emptyForm = useCallback(() => {
    const data = {}
    formFields.forEach((f) => { data[f.key] = '' })
    return data
  }, [formFields])

  // Fetch items
  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError('')
    const response = await api.getAll(searchTerm)
    if (response.status === 200) {
      setItems(response.data)
    } else {
      setError(response.data?.message || 'Failed to load data')
    }
    setLoading(false)
  }, [api, searchTerm])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // Fetch archived items
  const fetchArchived = useCallback(async () => {
    if (!api.getArchived) return
    setArchivedLoading(true)
    const response = await api.getArchived(searchTerm)
    if (response.status === 200) {
      setArchivedItems(response.data)
    }
    setArchivedLoading(false)
  }, [api, searchTerm])

  useEffect(() => {
    if (showArchived) fetchArchived()
  }, [showArchived, fetchArchived])

  // Open modal for create
  const handleAdd = () => {
    setEditingItem(null)
    setFormData(emptyForm())
    setModalOpen(true)
  }

  // Open modal for edit
  const handleEdit = (item) => {
    setEditingItem(item)
    const data = {}
    formFields.forEach((f) => { data[f.key] = item[f.key] ?? '' })
    setFormData(data)
    setModalOpen(true)
  }

  // Save (create or update)
  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    // Coerce number fields
    const payload = { ...formData }
    formFields.forEach((f) => {
      if (f.type === 'number' && payload[f.key] !== '') {
        payload[f.key] = Number(payload[f.key])
      }
    })

    let response
    if (editingItem) {
      response = await api.update(editingItem[idField], payload)
    } else {
      response = await api.create(payload)
    }

    if (response.status === 200 || response.status === 201) {
      setModalOpen(false)
      fetchItems()
    } else {
      setError(response.data?.message || 'Save failed')
    }
    setSaving(false)
  }

  // Delete with confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    const response = await api.delete(deleteTarget[idField])
    if (response.status === 200) {
      setDeleteTarget(null)
      fetchItems()
      if (showArchived) fetchArchived()
    } else {
      const msg = response.data?.message || 'Archive failed'
      setError(response.status === 409 ? `Cannot archive: ${msg}` : msg)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="crud-page">
      {/* Page header */}
      <div className="crud-header">
        <h1>{title}</h1>
        {/* @component
         * @id: {componentIds.addButton}
         * @label: Add {title} Button
         * @path: {pagePath}
         * @archetype: ACTION
         * @trigger: onClick
         * @ur_id: {urId}
         * @notes: Opens modal
         */}
        <button className="crud-add-btn" onClick={handleAdd}>
          + Add {title.replace(/s$/, '')}
        </button>
      </div>

      {/* Search bar */}
      {/* @component
       * @id: {componentIds.searchBar}
       * @label: Search Bar
       * @path: {pagePath}
       * @archetype: INPUT
       * @trigger: onChange
       * @ur_id: {urId}
       */}
      <div className="crud-search">
        <input
          type="text"
          placeholder={`Search ${title.toLowerCase()}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Error message */}
      {error && <div className="crud-error">{error}</div>}

      {/* Data table */}
      {/* @component
       * @id: {componentIds.table}
       * @label: {title} List Table
       * @path: {pagePath}
       * @archetype: DISPLAY
       * @trigger: onLoad
       * @ur_id: {urId}
       */}
      <div className="crud-table-wrapper">
        {loading ? (
          <p className="crud-loading">Loading...</p>
        ) : items.length === 0 ? (
          <p className="crud-empty">No {title.toLowerCase()} found. Add your first one.</p>
        ) : (
          <table className="crud-table">
            <thead>
              <tr>
                <th>#</th>
                {columns.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
                {showCreatedAt && <th>Created</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item[idField]}>
                  <td>{index + 1}</td>
                  {columns.map((col) => (
                    <td key={col.key}>{item[col.key]}</td>
                  ))}
                  {showCreatedAt && (
                    <td className="crud-date">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '-'}
                    </td>
                  )}
                  <td className="crud-actions">
                    {/* @component editButton */}
                    <button
                      className="crud-edit-btn"
                      onClick={() => handleEdit(item)}
                      title="Edit"
                    >
                      Edit
                    </button>
                    {/* @component deleteButton */}
                    <button
                      className="crud-delete-btn"
                      onClick={() => setDeleteTarget(item)}
                      title="Delete"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Archived section toggle */}
      {api.getArchived && (
        <div className="crud-archived-section">
          <button
            className="crud-archive-toggle"
            onClick={() => setShowArchived((prev) => !prev)}
            type="button"
          >
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </button>

          {showArchived && (
            <div className="crud-table-wrapper crud-archived-wrapper">
              {archivedLoading ? (
                <p className="crud-loading">Loading archived...</p>
              ) : archivedItems.length === 0 ? (
                <p className="crud-empty">No archived {title.toLowerCase()}.</p>
              ) : (
                <table className="crud-table crud-archived-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      {columns.map((col) => (
                        <th key={col.key}>{col.label}</th>
                      ))}
                      {showCreatedAt && <th>Created</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {archivedItems.map((item, index) => (
                      <tr key={item[idField]}>
                        <td>{index + 1}</td>
                        {columns.map((col) => (
                          <td key={col.key}>{item[col.key]}</td>
                        ))}
                        {showCreatedAt && (
                          <td className="crud-date">
                            {item.created_at
                              ? new Date(item.created_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
                              : '-'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="crud-modal-overlay" onClick={() => setModalOpen(false)}>
          {/* @component
           * @id: {componentIds.modal}
           * @label: {title} Form Modal
           * @path: {pagePath}
           * @archetype: CONTAINER
           * @trigger: onOpen
           * @ur_id: {urId}
           * @notes: Create or Edit
           */}
          <div className="crud-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingItem ? 'Edit' : 'Add'} {title.replace(/s$/, '')}</h2>
            <form onSubmit={handleSave}>
              {formFields.map((field) => (
                <div className="form-group" key={field.key}>
                  <label htmlFor={`field-${field.key}`}>{field.label}</label>
                  <input
                    id={`field-${field.key}`}
                    type={field.type || 'text'}
                    value={formData[field.key]}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    placeholder={field.placeholder || ''}
                    required={field.required}
                    min={field.type === 'number' ? 1 : undefined}
                  />
                </div>
              ))}

              {error && <div className="crud-error">{error}</div>}

              <div className="crud-modal-actions">
                {/* @component cancelButton */}
                <button
                  type="button"
                  className="crud-cancel-btn"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                {/* @component saveButton */}
                <button
                  type="submit"
                  className="crud-save-btn"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title={`Archive ${title.replace(/s$/, '')}?`}
          confirmLabel="Archive"
          message={`Are you sure you want to archive "${deleteTarget.name}"? Archived records remain in historical data but cannot be selected for new entries.`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

export default AdminCrudTable
