import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/login/LoginPage'
import ForgotPasswordPage from './pages/login/ForgotPasswordPage'
import AuthGuard from './components/AuthGuard'
import AdminLayout from './components/AdminLayout'
import AdminDashboard from './pages/admin/dashboard/AdminDashboard'
import VaccineTypes from './pages/admin/vaccine-types/VaccineTypes'
import BreedingTypes from './pages/admin/breeding-types/BreedingTypes'
import GoatBreeds from './pages/admin/goat-breeds/GoatBreeds'
import UserRegistration from './pages/admin/users/UserRegistration'
import UsersAndRoles from './pages/admin/roles/UsersAndRoles'
import PremiseManagement from './pages/admin/premises/PremiseManagement'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Admin routes — protected, requires Super Admin role */}
        <Route
          path="/admin"
          element={
            <AuthGuard requiredRole="Super Admin">
              <AdminLayout />
            </AuthGuard>
          }
        >
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="vaccine-types" element={<VaccineTypes />} />
          <Route path="breeding-types" element={<BreedingTypes />} />
          <Route path="goat-breeds" element={<GoatBreeds />} />
          <Route path="users" element={<UserRegistration />} />
          <Route path="roles" element={<UsersAndRoles />} />
          <Route path="premises" element={<PremiseManagement />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
