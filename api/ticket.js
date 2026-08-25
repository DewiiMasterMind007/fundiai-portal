import { appsScriptFailed, appsScriptErrorMessage } from './_lib/appsScript.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { client_email, bot, summary } = req.body

    const response = await fetch(process.env.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_email, bot, summary }),
    })

    const data = await response.json()

    if (appsScriptFailed(data)) {
      return res.status(500).json({ error: appsScriptErrorMessage(data) })
    }

    return res.status(response.status).json(data)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
