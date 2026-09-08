import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AdminContext = createContext(undefined)

function purgeStaleSupabaseKeys() {
  Object.keys(localStorage)
    .filter((key) => key.startsWith('sb-'))
    .forEach((key) => localStorage.removeItem(key))
}

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

  const signOut = async () => {
    // Same reasoning as ClientContext's signOut: flip local state
    // immediately rather than waiting on the SIGNED_OUT event or on
    // supabase.auth.signOut() itself, and force a redirect if it hasn't
    // resolved after a few seconds, so a stuck in-flight request can't
    // leave an admin staring at a loading screen forever.
    setAdmin(null)
    setLoading(false)

    let signedOut = false
    const forceRedirectTimer = setTimeout(() => {
      if (signedOut) return
      purgeStaleSupabaseKeys()
      window.location.assign('/login')
    }, 5000)

    try {
      await supabase.auth.signOut()
    } finally {
      signedOut = true
      clearTimeout(forceRedirectTimer)
    }

    purgeStaleSupabaseKeys()
  }

  return (
    <AdminContext.Provider value={{ admin, loading, signOut }}>
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
