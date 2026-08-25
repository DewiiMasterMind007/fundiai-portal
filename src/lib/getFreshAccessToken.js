import { supabase } from './supabase'

// Same buffer/pattern as ClientContext's own session-refresh check.
const EXPIRY_BUFFER_SECONDS = 10

// Returns a valid, non-near-expiry access token, refreshing first if the
// locally-cached session is at or near expiry — rather than trusting
// getSession()'s cached token blindly right before an authenticated
// request. Returns null if no session exists or a refresh attempt fails.
export async function getFreshAccessToken() {
  const { data } = await supabase.auth.getSession()
  let session = data?.session
  if (!session) return null

  const nowSeconds = Date.now() / 1000
  const expiresAt = session.expires_at

  if (!expiresAt || expiresAt - nowSeconds < EXPIRY_BUFFER_SECONDS) {
    const { data: refreshData, error: refreshError } =
      await supabase.auth.refreshSession()

    if (refreshError || !refreshData?.session) {
      return null
    }
    session = refreshData.session
  }

  return session.access_token
}
