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
