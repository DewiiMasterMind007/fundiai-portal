import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const ClientContext = createContext(undefined)

// Events that hand us a session we should actually (re)load client data
// for — explicitly includes TOKEN_REFRESHED alongside SIGNED_IN/
// INITIAL_SESSION so a refreshed token is treated just like a fresh login.
const SESSION_READY_EVENTS = new Set([
  'SIGNED_IN',
  'INITIAL_SESSION',
  'TOKEN_REFRESHED',
])

const EXPIRY_BUFFER_SECONDS = 10

export function ClientProvider({ children }) {
  const [session, setSession] = useState(null)
  const [client, setClient] = useState(null)
  const [fundiFileText, setFundiFileText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadTokenRef = useRef(0)

  useEffect(() => {
    async function loadClientData(initialSession) {
      const token = ++loadTokenRef.current
      setLoading(true)
      setError(null)

      try {
        let activeSession = initialSession
        const nowSeconds = Date.now() / 1000
        const expiresAt = activeSession.expires_at

        if (!expiresAt || expiresAt - nowSeconds < EXPIRY_BUFFER_SECONDS) {
          const { data: refreshData, error: refreshError } =
            await supabase.auth.refreshSession()

          if (loadTokenRef.current !== token) return

          if (refreshError || !refreshData?.session) {
            throw new Error(
              refreshError?.message ||
                'Your session could not be refreshed.',
            )
          }

          activeSession = refreshData.session
          setSession(activeSession)
        }

        const { data: clientRow, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('email', activeSession.user.email)
          .single()

        if (loadTokenRef.current !== token) return

        if (clientError || !clientRow) {
          throw new Error(clientError?.message ?? 'No client record found')
        }

        setClient(clientRow)

        if (clientRow.fundi_file_url) {
          try {
            const response = await fetch('/api/fundifile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: clientRow.fundi_file_url }),
            })
            const data = await response.json()
            if (loadTokenRef.current !== token) return

            if (!response.ok || data.text === null) {
              console.error('Failed to load fundi file:', data.error ?? data)
              setFundiFileText('')
            } else {
              setFundiFileText(data.text)
            }
          } catch (fundiFileError) {
            if (loadTokenRef.current !== token) return
            console.error('Failed to load fundi file:', fundiFileError)
            setFundiFileText('')
          }
        } else {
          setFundiFileText('')
        }
      } catch (err) {
        if (loadTokenRef.current !== token) return
        console.error('Failed to load client session:', err)
        setClient(null)
        setFundiFileText('')
        setError('Your session expired. Please log in again.')
        // Fully clear the bad session. The resulting SIGNED_OUT event
        // intentionally does not clear `error` below, so the UI can keep
        // showing the friendly message briefly before redirecting.
        await supabase.auth.signOut()
      } finally {
        if (loadTokenRef.current === token) setLoading(false)
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)

      if (!newSession) {
        setClient(null)
        setFundiFileText('')
        setLoading(false)
        return
      }

      if (SESSION_READY_EVENTS.has(event)) {
        loadClientData(newSession)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    // Safety net: guarantee no stale Supabase session data can leak into a
    // subsequent login or recovery flow in this browser.
    Object.keys(localStorage)
      .filter((key) => key.startsWith('sb-'))
      .forEach((key) => localStorage.removeItem(key))
  }

  const value = { session, client, fundiFileText, loading, error, signOut }

  return (
    <ClientContext.Provider value={value}>{children}</ClientContext.Provider>
  )
}

export function useClient() {
  const context = useContext(ClientContext)
  if (context === undefined) {
    throw new Error('useClient must be used within a ClientProvider')
  }
  return context
}
