import { useEffect, useLayoutEffect, useState } from 'react'
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

  // useLayoutEffect, not useEffect: this must clear the flag before the
  // fresh ClientProvider mounted below (when not an admin) runs its own
  // effect and registers its onAuthStateChange listener — layout effects
  // always run before passive effects in the same commit, regardless of
  // parent/child order, so this can't lose the race the way two regular
  // effects could.
  useLayoutEffect(() => {
    if (loading) return
    // Admin status is now known either way — release ClientContext's guard
    // so a "not admin" outcome lets the fresh ClientProvider below load
    // normally (see the comment in AuthGate for why this flag is set).
    sessionStorage.removeItem(SETTING_PASSWORD_FLAG_KEY)
  }, [loading])

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
      // A session already exists on first load (e.g. a page refresh) —
      // guard it too, in case a TOKEN_REFRESHED or similar event reaches
      // a stray ClientContext listener while admin status is still
      // unknown. Harmless no-op if this turns out to be a plain client;
      // AdminOrClientGate's effect clears it once admin status resolves.
      if (data.session) {
        sessionStorage.setItem(SETTING_PASSWORD_FLAG_KEY, 'true')
      }
      setHasSession(!!data.session)
      setSessionChecked(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryFlow(true)
      }

      // This must run synchronously, before any setState below, and
      // before ClientContext's own listener for this same event gets a
      // chance to run (listeners fire in registration order, and this
      // one was registered first). Without it, the pre-login
      // ClientProvider mounted so Login.jsx can render is still
      // subscribed at the exact moment a brand-new session appears —
      // its listener would immediately try to load a `clients` row for
      // it. For an admin (who has no such row) that fetch fails, and
      // ClientContext's existing error handling signs the session back
      // out — destroying the very session an admin just logged into,
      // regardless of the component unmounting a moment later. Setting
      // this flag makes ClientContext's own existing guard (already used
      // for the password-recovery flow) skip that fetch-and-signout
      // routine entirely until admin status is known.
      if (newSession) {
        sessionStorage.setItem(SETTING_PASSWORD_FLAG_KEY, 'true')
      }

      setHasSession(!!newSession)
      setSessionChecked(true)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  // Note: this deliberately does NOT also check the sessionStorage flag
  // itself (unlike the pre-admin-portal version of this gate) — this
  // component now writes that same flag below for an unrelated reason
  // (telling ClientContext to stand down while admin status is being
  // checked), so treating "flag is set" as "show SetPassword" here would
  // misfire the moment any session appears. `isRecoveryFlow` alone is
  // sufficient: it's set synchronously from the URL on mount and via the
  // PASSWORD_RECOVERY event, and never reset back to false.
  if (isRecoveryFlow) {
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
