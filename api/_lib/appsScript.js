// Apps Script's ContentService always responds with HTTP 200, even when the
// script itself failed internally — so a response that looks successful at
// the HTTP layer can still carry a real error in its JSON body. Every
// /api/*.js route that proxies to APPS_SCRIPT_URL must check this before
// trusting the parsed response, instead of passing a "200 OK" straight
// through to the frontend with the error buried inside it.
export function appsScriptFailed(data) {
  return Boolean(data) && (Boolean(data.error) || data.success === false)
}

export function appsScriptErrorMessage(data) {
  return data?.error || 'Apps Script request failed'
}
