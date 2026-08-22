import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function SetPassword() {
  const [status, setStatus] = useState('verifying') // 'verifying' | 'ready' | 'invalid'
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function verify() {
      try {
        const code = new URLSearchParams(window.location.search).get('code')

        if (code) {
          await supabase.auth.exchangeCodeForSession(window.location.href)
        }

        // The older hash-based flow (#access_token=...&type=recovery) is
        // processed automatically by the Supabase client on init, so by
        // this point it should already be reflected in getSession() too —
        // this call is the single source of truth for both link styles.
        const { data } = await supabase.auth.getSession()
        if (cancelled) return

        setStatus(data?.session?.user ? 'ready' : 'invalid')
      } catch (err) {
        if (cancelled) return
        console.error('Failed to verify recovery session:', err)
        setStatus('invalid')
      }
    }

    verify()

    // Fallback: if the hash was still being processed asynchronously when
    // `verify` first ran, PASSWORD_RECOVERY fires once it's done — re-check.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        verify()
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })
    setSubmitting(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    // Use a full navigation (not react-router's navigate) so the
    // #type=recovery hash / ?code= query is actually dropped and App
    // re-evaluates the recovery gate fresh — a client-side route change
    // alone leaves the old URL in place and would keep rendering this
    // screen forever.
    window.location.assign('/')
  }

  if (status === 'verifying') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fundi-bg font-sans">
        <p className="text-sm text-gray-500">Verifying your link...</p>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fundi-bg font-sans">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
          <p className="text-fundi-dark">
            This link has expired or already been used. Please request a
            new password reset from the login screen.
          </p>
          <Link
            to="/login"
            className="mt-4 inline-block text-sm font-medium text-fundi-blue hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-fundi-bg font-sans">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mb-4 text-2xl font-bold text-fundi-dark">FA</div>
          <h1 className="text-xl font-semibold text-fundi-dark">
            Set Your Password
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className="w-full rounded-full border border-gray-300 px-4 py-2 text-fundi-dark focus:border-fundi-blue focus:outline-none"
          />
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            className="w-full rounded-full border border-gray-300 px-4 py-2 text-fundi-dark focus:border-fundi-blue focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-fundi-blue px-4 py-2 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Setting password...' : 'Set Password'}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
