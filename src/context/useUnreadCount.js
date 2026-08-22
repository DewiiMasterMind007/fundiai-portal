import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useClient } from './ClientContext'

export function useUnreadCount() {
  const { client } = useClient()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!client?.email) return

    let cancelled = false

    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('client_email', client.email)
      .eq('is_read', false)
      .then(({ count, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Failed to fetch unread count:', error.message)
          return
        }
        setUnreadCount(count ?? 0)
      })

    return () => {
      cancelled = true
    }
  }, [client?.email, location.pathname])

  return unreadCount
}
