import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import AdminSidebar from './components/AdminSidebar'
import AdminDashboard from './screens/admin/AdminDashboard'

function AdminShell() {
  return (
    <div className="flex h-screen bg-fundi-dark">
      <AdminSidebar />
      <div className="flex-1 rounded-l-3xl bg-fundi-bg p-6">
        <div className="h-full overflow-auto rounded-2xl bg-white p-6 shadow-sm">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default function AdminApp() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminShell />}>
        <Route index element={<AdminDashboard />} />
      </Route>
      {/* Any unmatched /admin/* path, and any admin session landing on a
          non-admin path (e.g. "/"), lands back on the dashboard. */}
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}
