import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AdminContext = createContext(undefined)

export function AdminProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadAdmin() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (cancelled) return

      if (!session?.user?.email) {
        setAdmin(null)
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('email', session.user.email)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        console.error('Failed to load admin record:', error.message)
        setAdmin(null)
      } else {
        setAdmin(data ?? null)
      }
      setLoading(false)
    }

    loadAdmin()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <AdminContext.Provider value={{ admin, loading }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const context = useContext(AdminContext)
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider')
  }
  return context
}
