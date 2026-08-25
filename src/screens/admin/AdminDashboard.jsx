import { useAdmin } from '../../context/AdminContext'

export default function AdminDashboard() {
  const { admin } = useAdmin()

  return (
    <div className="font-sans">
      <h1 className="text-2xl font-semibold text-fundi-dark">
        Admin Dashboard
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Welcome, {admin?.full_name}.
      </p>
    </div>
  )
}
