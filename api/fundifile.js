export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { url } = req.body

    const match = url?.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
    if (!match) {
      return res.status(200).json({ text: null, error: 'Invalid URL' })
    }

    const docId = match[1]

    try {
      const docResponse = await fetch(
        `https://docs.google.com/document/d/${docId}/export?format=txt`,
      )

      if (!docResponse.ok) {
        return res.status(200).json({
          text: null,
          error: `Failed to fetch document: ${docResponse.status} ${docResponse.statusText}`,
        })
      }

      const text = await docResponse.text()
      return res.status(200).json({ text })
    } catch (fetchError) {
      return res.status(200).json({ text: null, error: fetchError.message })
    }
  } catch (error) {
    return res.status(500).json({ text: null, error: error.message })
  }
}
