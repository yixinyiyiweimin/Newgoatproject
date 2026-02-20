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