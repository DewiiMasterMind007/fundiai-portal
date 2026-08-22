import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useClient } from '../context/ClientContext'

export default function Login() {
  const { session, loading } = useClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [forgotPasswordMode, setForgotPasswordMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  if (!loading && session) {
    return <Navigate to="/" replace />
  }

  function backToSignIn() {
    setForgotPasswordMode(false)
    setResetSent(false)
    setError(null)
    setPassword('')
  }

  async function handleSignIn(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setSubmitting(false)

    if (signInError) {
      setError(signInError.message)
    }
  }

  async function handleSendReset(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: window.location.origin },
    )

    setSubmitting(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setResetSent(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-fundi-bg font-sans">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <img
            src="/HorizontalLogo_FundiAI.png"
            alt="FundiAI"
            className="mx-auto mb-4 h-16 w-16 object-contain"
          />
          <h1 className="text-xl font-semibold text-fundi-dark">
            Fundi AI Client Portal
          </h1>
        </div>

        {resetSent ? (
          <div className="text-center">
            <p className="text-fundi-dark">Check your email</p>
            <p className="mt-2 text-sm text-gray-500">
              We sent a password reset link to {email}.
            </p>
            <button
              type="button"
              onClick={backToSignIn}
              className="mt-4 text-sm font-medium text-fundi-blue hover:underline"
            >
              Back to sign in
            </button>
          </div>
        ) : forgotPasswordMode ? (
          <form onSubmit={handleSendReset} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-full border border-gray-300 px-4 py-2 text-fundi-dark focus:border-fundi-blue focus:outline-none"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-fundi-blue px-4 py-2 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Sending...' : 'Send reset link'}
            </button>
            <button
              type="button"
              onClick={backToSignIn}
              className="w-full text-center text-sm text-gray-500 hover:text-fundi-blue hover:underline"
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignIn} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-full border border-gray-300 px-4 py-2 text-fundi-dark focus:border-fundi-blue focus:outline-none"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-full border border-gray-300 px-4 py-2 text-fundi-dark focus:border-fundi-blue focus:outline-none"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-fundi-blue px-4 py-2 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => {
                setForgotPasswordMode(true)
                setError(null)
              }}
              className="w-full text-center text-sm text-gray-500 hover:text-fundi-blue hover:underline"
            >
              Forgot password?
            </button>
          </form>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
