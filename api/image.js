export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { fileId, download, name } = req.query

    if (!fileId) {
      return res.status(400).json({ error: 'fileId is required' })
    }

    const targetUrl = `${process.env.APPS_SCRIPT_URL}?action=image&fileId=${encodeURIComponent(fileId)}`
    const response = await fetch(targetUrl)
    const json = await response.json()

    if (!response.ok || !json.success) {
      const errorMessage = json?.error || `Image fetch failed with status ${response.status}`
      return res.status(response.ok ? 502 : response.status).json({ error: errorMessage })
    }

    const buffer = Buffer.from(json.base64, 'base64')
    const contentType = json.mimeType || 'image/png'

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=3600')

    if (download === '1') {
      const filename = json.fileName || name || 'file'
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    }

    return res.status(200).send(buffer)
  } catch (error) {
    console.error('api/image error:', error)
    return res.status(500).json({ error: error.message })
  }
}
