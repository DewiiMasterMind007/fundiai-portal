import { useEffect, useState } from 'react'
import { ClientProvider } from './context/ClientContext'
import { AdminProvider, useAdmin } from './context/AdminContext'
import { supabase } from './lib/supabase'
import { detectRecoverySignal, SETTING_PASSWORD_FLAG_KEY } from './lib/authRecovery'
import SetPassword from './screens/SetPassword'
import ClientApp from './ClientApp'
import AdminApp from './AdminApp'

function CenteredLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-fundi-bg font-sans text-fundi-dark">
      Loading...
    </div>
  )
}

// Runs once a session is confirmed to exist — decides between the admin
// app and the existing client app based on AdminContext's lookup.
function AdminOrClientGate() {
  const { admin, loading } = useAdmin()

  if (loading) {
    return <CenteredLoading />
  }

  if (admin) {
    return <AdminApp />
  }

  // Not an admin — this is a normal client session. Mount ClientProvider
  // and render the existing client app exactly as it works today.
  return (
    <ClientProvider>
      <ClientApp />
    </ClientProvider>
  )
}

// Top-level gate, rendered before ClientProvider/AdminProvider exist.
// Decides, purely from raw session state, which provider tree (if any)
// should even be mounted — ClientContext's own logic is never touched.
export default function AuthGate() {
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(() =>
    detectRecoverySignal(),
  )
  const [sessionChecked, setSessionChecked] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setHasSession(!!data.session)
      setSessionChecked(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryFlow(true)
      }
      setHasSession(!!newSession)
      setSessionChecked(true)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  // Read fresh on every render (not just at mount) — while SetPassword
  // owns the session, it must keep rendering regardless of anything else
  // going on here.
  const isSettingPassword =
    sessionStorage.getItem(SETTING_PASSWORD_FLAG_KEY) === 'true'

  if (isRecoveryFlow || isSettingPassword) {
    return (
      <ClientProvider>
        <SetPassword />
      </ClientProvider>
    )
  }

  if (!sessionChecked) {
    return <CenteredLoading />
  }

  if (!hasSession) {
    // No session — existing Login/SetPassword logic, completely unchanged.
    return (
      <ClientProvider>
        <ClientApp />
      </ClientProvider>
    )
  }

  // A session exists — check admin status before deciding which app to
  // mount. An admin has no `clients` row, so ClientProvider must never be
  // mounted for that session.
  return (
    <AdminProvider>
      <AdminOrClientGate />
    </AdminProvider>
  )
}
