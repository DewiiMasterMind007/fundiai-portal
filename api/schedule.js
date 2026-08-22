export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { action, sheetId, tab, row } = req.query

    const params = new URLSearchParams()
    if (action) params.set('action', action)
    if (sheetId) params.set('sheetId', sheetId)
    if (tab) params.set('tab', tab)
    if (row) params.set('row', row)

    const targetUrl = `${process.env.APPS_SCRIPT_URL}?${params.toString()}`
    const response = await fetch(targetUrl)
    const data = await response.json()

    return res.status(response.status).json(data)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
