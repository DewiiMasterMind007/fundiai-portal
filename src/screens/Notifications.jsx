import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Bell, RefreshCw } from 'lucide-react'
import { useClient } from '../context/ClientContext'
import { supabase } from '../lib/supabase'

const BOT_COPY = {
  poppie: { name: 'Poppie', role: 'Social Media Fundi' },
  chad: { name: 'Chad', role: 'Website & SEO Fundi' },
}

const DECORATIVE_SLOTS = 5

function BotAvatar({ botName }) {
  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-fundi-dark text-xs font-semibold text-white">
      {botName.charAt(0)}
    </div>
  )
}

export default function Notifications() {
  const { client } = useClient()
  const location = useLocation()
  const navigate = useNavigate()

  const bot = BOT_COPY[client.bot_assigned] ?? { name: 'Fundi', role: 'Your AI Assistant' }

  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(false)
  const [unreadDividerId, setUnreadDividerId] = useState(null)

  const fetchTokenRef = useRef(0)

  async function fetchNotifications() {
    const token = ++fetchTokenRef.current
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('client_email', client.email)
        .eq('bot', client.bot_assigned)
        .order('created_at', { ascending: true })

      if (fetchTokenRef.current !== token) return
      if (fetchError) throw new Error(fetchError.message)

      setNotifications(data ?? [])
    } catch (err) {
      if (fetchTokenRef.current !== token) return
      setError(err.message)
    } finally {
      if (fetchTokenRef.current === token) setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.email, client.bot_assigned, location.pathname])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  async function handleSelectBot() {
    setSelected(true)

    const firstUnread = notifications.find((n) => !n.is_read)
    setUnreadDividerId(firstUnread?.id ?? null)

    if (!firstUnread) return

    const { error: updateError } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('client_email', client.email)
      .eq('bot', client.bot_assigned)
      .eq('is_read', false)

    if (updateError) {
      console.error('Failed to mark notifications as read:', updateError.message)
      return
    }

    // Reflect locally right away so the badge drops to 0 immediately,
    // without waiting on a route change to re-trigger the fetch effect.
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    fetchNotifications()
  }

  function handleReviewClick(link) {
    if (link.startsWith('http')) {
      window.open(link, '_blank', 'noopener,noreferrer')
    } else {
      navigate(link)
    }
  }

  return (
    <div className="flex h-full gap-6 font-sans">
      <div
        className="flex w-56 flex-shrink-0 flex-col gap-4 rounded-2xl p-4"
        style={{ background: 'var(--fundi-gradient)' }}
      >
        <h1 className="text-lg font-bold text-white">Fundi's DM</h1>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleSelectBot}
            aria-label={bot.name}
            className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-white text-lg font-bold text-fundi-dark transition ${
              selected ? 'ring-4 ring-fundi-green' : 'hover:opacity-90'
            }`}
          >
            {bot.name.charAt(0)}
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {Array.from({ length: DECORATIVE_SLOTS }).map((_, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="h-14 w-14 rounded-full bg-white/10 opacity-40 grayscale"
            />
          ))}
        </div>
      </div>

      <div className="flex h-full flex-1 flex-col overflow-hidden">
        <div className="mb-2 flex items-center justify-between">
          <div>
            {selected && (
              <>
                <h2 className="text-lg font-semibold text-fundi-dark">
                  {bot.name}
                </h2>
                <p className="text-xs text-gray-500">{bot.role}</p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={fetchNotifications}
            aria-label="Refresh"
            className="flex h-8 w-8 items-center justify-center rounded-full text-fundi-dark transition hover:bg-fundi-bg"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error ? (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          ) : !selected ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <Bell size={32} className="text-fundi-blue" />
              <p className="text-fundi-dark">Select a Fundi to check messages</p>
            </div>
          ) : loading ? (
            <p className="mt-16 text-center text-sm text-gray-400">
              Loading messages...
            </p>
          ) : notifications.length === 0 ? (
            <p className="mt-16 text-center text-sm text-gray-400">
              You're all caught up 🎉
            </p>
          ) : (
            <div className="space-y-1 px-1">
              {notifications.map((n) => (
                <div key={n.id}>
                  <p className="my-2 text-center text-xs text-gray-400">
                    {n.created_at &&
                      format(new Date(n.created_at), 'd MMMM yyyy, h:mmaaa')}
                  </p>

                  {n.id === unreadDividerId && (
                    <div className="my-3 flex items-center justify-center">
                      <span className="rounded-full bg-fundi-green px-3 py-1 text-xs font-semibold text-white">
                        New Unread Messages
                      </span>
                    </div>
                  )}

                  <div className="flex items-start gap-2">
                    <BotAvatar botName={bot.name} />
                    <div
                      className="max-w-md rounded-2xl rounded-bl-sm px-4 py-2 text-white"
                      style={{ background: 'var(--fundi-gradient)' }}
                    >
                      {n.message}
                    </div>
                  </div>

                  {n.link && (
                    <div className="ml-10 mt-2">
                      <button
                        type="button"
                        onClick={() => handleReviewClick(n.link)}
                        className="rounded-full bg-fundi-blue px-4 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
                      >
                        Review Content
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
