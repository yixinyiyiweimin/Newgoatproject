import { useState, useEffect } from 'react'
import { adminDashboardApi } from '../../../utils/api'
import './AdminDashboard.css'

function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [premiseFilter, setPremiseFilter] = useState('')
  const [icFilter, setIcFilter] = useState('')

  const fetchDashboard = async (params = {}) => {
    setLoading(true)
    setError('')
    const response = await adminDashboardApi.getDashboard(params)
    if (response.status === 200) {
      setData(response.data)
    } else {
      setError(response.data?.message || 'Failed to load dashboard')
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  const handleFilter = () => {
    const params = {}
    if (premiseFilter.trim()) params.premise_id = premiseFilter.trim()
    if (icFilter.trim()) params.ic = icFilter.trim()
    fetchDashboard(params)
  }

  const handleClearFilter = () => {
    setPremiseFilter('')
    setIcFilter('')
    fetchDashboard()
  }

  // Find max count for bar chart scaling
  const maxCount = data?.premises_by_state?.reduce((max, s) => Math.max(max, parseInt(s.count)), 0) || 1

  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard</h1>

      {error && <div className="dash-error">{error}</div>}

      {/* ─── Filter Controls ──────────────────────────────── */}
      <div className="dash-filters">
        {/* @component
         * @id: A-DASH-003
         * @label: Premise ID Filter
         * @path: /admin/dashboard
         * @archetype: INPUT
         * @trigger: onChange
         * @api: GET /api/admin/dashboard?premise_id=
         * @ur_id: 2.1.2
         */}
        <input
          type="text"
          placeholder="Filter by Premise ID..."
          value={premiseFilter}
          onChange={(e) => setPremiseFilter(e.target.value)}
        />

        {/* @component
         * @id: A-DASH-004
         * @label: IC Number Search
         * @path: /admin/dashboard
         * @archetype: INPUT
         * @trigger: onChange
         * @api: GET /api/admin/dashboard?ic=
         * @ur_id: 2.1.2
         */}
        <input
          type="text"
          placeholder="Search by IC Number..."
          value={icFilter}
          onChange={(e) => setIcFilter(e.target.value)}
        />

        <button className="dash-filter-btn" onClick={handleFilter}>
          Apply Filter
        </button>
        {(premiseFilter || icFilter) && (
          <button className="dash-clear-btn" onClick={handleClearFilter}>
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <p className="dash-loading">Loading dashboard...</p>
      ) : data ? (
        <>
          {/* ─── Stat Cards ──────────────────────────────── */}
          <div className="dash-cards">
            {/* @component
             * @id: A-DASH-001
             * @label: Total Premises Card
             * @path: /admin/dashboard
             * @archetype: CONTAINER
             * @trigger: onLoad
             * @api: GET /api/admin/dashboard
             * @ur_id: 2.1.2
             */}
            <div className="dash-card">
              <span className="dash-card-value">{data.total_premises}</span>
              <span className="dash-card-label">Total Premises</span>
            </div>

            {/* @component
             * @id: A-DASH-002
             * @label: Premises by Location Card
             * @path: /admin/dashboard
             * @archetype: CONTAINER
             * @trigger: onLoad
             * @api: GET /api/admin/dashboard
             * @ur_id: 2.1.2
             */}
            <div className="dash-card">
              <span className="dash-card-value">{data.premises_by_state?.length || 0}</span>
              <span className="dash-card-label">States with Premises</span>
            </div>

            <div className="dash-card">
              <span className="dash-card-value">{data.total_users}</span>
              <span className="dash-card-label">Active Users</span>
            </div>
          </div>

          {/* ─── State Distribution Chart ─────────────────── */}
          {/* @component
           * @id: A-DASH-005
           * @label: State Distribution Chart
           * @path: /admin/dashboard
           * @archetype: DISPLAY
           * @trigger: onLoad
           * @api: GET /api/admin/dashboard
           * @ur_id: 2.1.2
           */}
          <div className="dash-chart-section">
            <h2>Premises by State</h2>
            {data.premises_by_state?.length === 0 ? (
              <p className="dash-empty">No premise data available.</p>
            ) : (
              <div className="dash-bar-chart">
                {data.premises_by_state.map((item) => (
                  <div className="dash-bar-row" key={item.state || 'unknown'}>
                    <span className="dash-bar-label">{item.state || 'Unknown'}</span>
                    <div className="dash-bar-track">
                      <div
                        className="dash-bar-fill"
                        style={{ width: `${(parseInt(item.count) / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="dash-bar-value">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── District Breakdown Table ─────────────────── */}
          {data.premises_by_district?.length > 0 && (
            <div className="dash-table-section">
              <h2>Premises by District</h2>
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>State</th>
                    <th>District</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {data.premises_by_district.map((item, i) => (
                    <tr key={i}>
                      <td>{item.state || 'Unknown'}</td>
                      <td>{item.district || 'Unknown'}</td>
                      <td>{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

export default AdminDashboard
