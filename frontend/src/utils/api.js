/**
 * Real API client for Goat Farm Management System
 * Replaces mockApi.js — sends real HTTP requests to Express API
 * API base URL configurable via VITE_API_URL env var, defaults to localhost:3000
 */

import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach auth token to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 responses globally (expired/invalid token)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Don't redirect if already on login-related endpoints
      const url = error.config?.url || ''
      if (!url.includes('/auth/')) {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Wrapper returns { status, data } matching mockAuthApi format
async function request(method, url, body) {
  try {
    const response = await apiClient({ method, url, data: body })
    return { status: response.status, data: response.data }
  } catch (error) {
    if (error.response) {
      return { status: error.response.status, data: error.response.data }
    }
    return { status: 500, data: { message: 'Network error. Please try again.' } }
  }
}

// ─── Auth API ────────────────────────────────────────────────

export const authApi = {
  login(identifier, password) {
    return request('post', '/auth/login', { identifier, password })
  },

  forgotPassword(email) {
    return request('post', '/auth/forgot-password', { email })
  },

  resetPassword(email, otp, newPassword) {
    return request('post', '/auth/reset-password', {
      email,
      otp,
      new_password: newPassword,
    })
  },
}

// ─── Admin Dashboard API ─────────────────────────────────────

export const adminDashboardApi = {
  getDashboard(params = {}) {
    const query = new URLSearchParams()
    if (params.premise_id) query.set('premise_id', params.premise_id)
    if (params.ic) query.set('ic', params.ic)
    const qs = query.toString()
    return request('get', `/admin/dashboard${qs ? '?' + qs : ''}`)
  },
}

// ─── Vaccine Types API ───────────────────────────────────────

export const vaccineTypeApi = {
  getAll(search) {
    const query = search ? `?search=${encodeURIComponent(search)}` : ''
    return request('get', `/admin/vaccine-types${query}`)
  },
  getArchived(search) {
    const query = search ? `?search=${encodeURIComponent(search)}` : ''
    return request('get', `/admin/vaccine-types/archived${query}`)
  },
  create(data) {
    return request('post', '/admin/vaccine-types', data)
  },
  update(id, data) {
    return request('patch', `/admin/vaccine-types/${id}`, data)
  },
  delete(id) {
    return request('delete', `/admin/vaccine-types/${id}`)
  },
}

// ─── Breeding Types API ──────────────────────────────────────

export const breedingTypeApi = {
  getAll(search) {
    const query = search ? `?search=${encodeURIComponent(search)}` : ''
    return request('get', `/admin/breeding-types${query}`)
  },
  getArchived(search) {
    const query = search ? `?search=${encodeURIComponent(search)}` : ''
    return request('get', `/admin/breeding-types/archived${query}`)
  },
  create(data) {
    return request('post', '/admin/breeding-types', data)
  },
  update(id, data) {
    return request('patch', `/admin/breeding-types/${id}`, data)
  },
  delete(id) {
    return request('delete', `/admin/breeding-types/${id}`)
  },
}

// ─── Goat Breeds API ─────────────────────────────────────────

export const goatBreedApi = {
  getAll(search) {
    const query = search ? `?search=${encodeURIComponent(search)}` : ''
    return request('get', `/admin/goat-breeds${query}`)
  },
  getArchived(search) {
    const query = search ? `?search=${encodeURIComponent(search)}` : ''
    return request('get', `/admin/goat-breeds/archived${query}`)
  },
  create(data) {
    return request('post', '/admin/goat-breeds', data)
  },
  update(id, data) {
    return request('patch', `/admin/goat-breeds/${id}`, data)
  },
  delete(id) {
    return request('delete', `/admin/goat-breeds/${id}`)
  },
}

// ─── Admin User Registration API ─────────────────────────────

export const adminUserApi = {
  getAll(search) {
    const query = search ? `?q=${encodeURIComponent(search)}` : ''
    return request('get', `/admin/users${query}`)
  },
  getById(id) {
    return request('get', `/admin/users/${id}`)
  },
  create(data) {
    return request('post', '/admin/users', data)
  },
  update(id, data) {
    return request('patch', `/admin/users/${id}`, data)
  },
  delete(id) {
    return request('delete', `/admin/users/${id}`)
  },
  resendCredentials(id) {
    return request('post', `/admin/users/${id}/resend`)
  },
}

// ─── Roles API ───────────────────────────────────────────────

// ─── Premise Management API ──────────────────────────────────

export const premiseApi = {
  getAll(search) {
    const query = search ? `?search=${encodeURIComponent(search)}` : ''
    return request('get', `/admin/premises${query}`)
  },
  getArchived(search) {
    const query = search ? `?search=${encodeURIComponent(search)}` : ''
    return request('get', `/admin/premises/archived${query}`)
  },
  getDropdown() {
    return request('get', '/admin/premises/dropdown')
  },
  create(data) {
    return request('post', '/admin/premises', data)
  },
  update(id, data) {
    return request('patch', `/admin/premises/${id}`, data)
  },
  delete(id) {
    return request('delete', `/admin/premises/${id}`)
  },
}

// ─── Roles API ───────────────────────────────────────────────

export const roleApi = {
  getRoles() {
    return request('get', '/admin/roles')
  },
  getUsers() {
    return request('get', '/admin/roles/users')
  },
  getPermissions() {
    return request('get', '/admin/roles/permissions')
  },
  createRole(data) {
    return request('post', '/admin/roles', data)
  },
  updateRole(id, data) {
    return request('patch', `/admin/roles/${id}`, data)
  },
  deleteRole(id) {
    return request('delete', `/admin/roles/${id}`)
  },
  assignRole(userAccountId, roleId) {
    return request('patch', `/admin/roles/users/${userAccountId}`, { role_id: roleId })
  },
  updateUserStatus(userAccountId, status) {
    return request('patch', `/admin/roles/users/${userAccountId}/status`, { status })
  },
}
