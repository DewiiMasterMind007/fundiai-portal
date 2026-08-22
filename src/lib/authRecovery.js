// Set by SetPassword while it owns the auth session, so ClientContext's
// global listener knows to stay out of the way — see SetPassword.jsx and
// ClientContext.jsx for the read/write sides of this handshake.
export const SETTING_PASSWORD_FLAG_KEY = 'fundi_setting_password'

export function detectRecoveryHash() {
  if (typeof window === 'undefined' || !window.location.hash) return false
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const type = params.get('type')
  return type === 'invite' || type === 'recovery'
}

// Newer Supabase PKCE-style recovery/invite links use a `code` query param
// instead of hash tokens.
export function detectRecoveryCode() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).has('code')
}

export function detectRecoverySignal() {
  return detectRecoveryHash() || detectRecoveryCode()
}
