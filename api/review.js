export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { id } = req.query

    if (!id) {
      return res.status(400).json({ error: 'id is required' })
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    const response = await fetch(
      `${supabaseUrl}/rest/v1/file_reviews?id=eq.${encodeURIComponent(id)}&select=*`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    )

    const data = await response.json()

    if (!response.ok) {
      const errorMessage = data?.message || data?.error || JSON.stringify(data)
      return res.status(response.status).json({ error: errorMessage })
    }

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(404).json({ error: 'Review not found' })
    }

    return res.status(200).json(data[0])
  } catch (error) {
    console.error('api/review error:', error)
    return res.status(500).json({ error: error.message })
  }
}
