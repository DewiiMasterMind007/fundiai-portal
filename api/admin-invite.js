import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization header' })
    }

    const userResponse = await fetch(
      `${process.env.VITE_SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: process.env.VITE_SUPABASE_ANON_KEY,
        },
      },
    )

    if (!userResponse.ok) {
      return res.status(401).json({ error: 'Invalid or expired session' })
    }

    const user = await userResponse.json()
    const email = user?.email

    if (!email) {
      return res.status(401).json({ error: 'Invalid or expired session' })
    }

    const adminResponse = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/admins?email=eq.${encodeURIComponent(email)}&select=email`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    )

    if (!adminResponse.ok) {
      return res.status(500).json({
        error: `Failed to verify admin: ${adminResponse.status} ${adminResponse.statusText}`,
      })
    }

    const adminRows = await adminResponse.json()
    if (!Array.isArray(adminRows) || adminRows.length === 0) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    const { email: inviteEmail } = req.body

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )

    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      inviteEmail,
      { redirectTo: 'https://portal.fundiai.co.za' },
    )

    if (inviteError) {
      return res.status(500).json({ error: inviteError.message })
    }

    return res.status(200).json({ success: true })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
