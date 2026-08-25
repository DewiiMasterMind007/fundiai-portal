import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bell, RefreshCw } from 'lucide-react'
import { useClient } from '../context/ClientContext'
import { supabase } from '../lib/supabase'
import { BOTS } from '../lib/bots'
import { ASSISTANT_MARKDOWN_CLASSES } from '../lib/markdownBubble'

const TOTAL_AVATAR_SLOTS = 6

function BotAvatar({ botName }) {
  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-fundi-dark text-xs font-semibold text-white">
      {botName.charAt(0)}
    </div>
  )
}

function TicketApprovalCard({ ticket, botName, actionState, onApprove, onRequestChanges }) {
  const [showChangesForm, setShowChangesForm] = useState(false)
  const [changesText, setChangesText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState(null)

  const approved = actionState === 'approved'
  const changesRequested = actionState === 'changes-requested'

  async function handleApproveClick() {
    setSubmitting(true)
    setLocalError(null)
    const err = await onApprove(ticket)
    setSubmitting(false)
    if (err) setLocalError(err)
  }

  async function handleSubmitChanges() {
    const trimmed = changesText.trim()
    if (!trimmed) return

    setSubmitting(true)
    setLocalError(null)
    const err = await onRequestChanges(ticket, trimmed)
    setSubmitting(false)

    if (err) {
      setLocalError(err)
    } else {
      setShowChangesForm(false)
    }
  }

  return (
    <div className="flex items-start gap-2">
      <BotAvatar botName={botName} />
      <div className="max-w-md rounded-2xl rounded-bl-sm border-2 border-dashed border-fundi-blue/40 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-fundi-dark/50">
          Ready for your review
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-fundi-dark">
          {ticket.request_summary}
        </p>

        {approved ? (
          <p className="mt-2 text-xs font-medium text-fundi-green">✅ Approved</p>
        ) : changesRequested ? (
          <p className="mt-2 text-xs font-medium text-fundi-blue">
            Sent back to the team for changes.
          </p>
        ) : (
          <>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={handleApproveClick}
                className="rounded-full bg-fundi-green px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowChangesForm((v) => !v)}
                className="rounded-full bg-fundi-bg px-3 py-1.5 text-xs font-medium text-fundi-dark transition hover:bg-fundi-bg/70 disabled:opacity-50"
              >
                Request Changes
              </button>
            </div>

            {showChangesForm && (
              <div className="mt-2 space-y-2">
                <textarea
                  value={changesText}
                  onChange={(e) => setChangesText(e.target.value)}
                  disabled={submitting}
                  rows={2}
                  placeholder="What still needs changing?"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-fundi-dark outline-none focus:border-fundi-blue"
                />
                <button
                  type="button"
                  disabled={submitting || !changesText.trim()}
                  onClick={handleSubmitChanges}
                  className="rounded-full bg-fundi-blue px-4 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Sending...' : 'Send'}
                </button>
              </div>
            )}
          </>
        )}

        {localError && (
          <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">
            {localError}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Notifications() {
  const { client } = useClient()
  const location = useLocation()
  const navigate = useNavigate()

  const [activeBotIds, setActiveBotIds] = useState([])
  const [unreadCounts, setUnreadCounts] = useState({})
  const [selectedBotId, setSelectedBotId] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [awaitingTickets, setAwaitingTickets] = useState([])
  const [ticketActionState, setTicketActionState] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [unreadDividerId, setUnreadDividerId] = useState(null)

  const fetchTokenRef = useRef(0)

  async function fetchActiveBotsAndCounts() {
    const { data: botsData, error: botsError } = await supabase
      .from('client_bots')
      .select('bot')
      .eq('client_email', client.email)

    if (botsError) {
      setError(botsError.message)
      return
    }

    const botIds = (botsData ?? []).map((row) => row.bot)
    setActiveBotIds(botIds)

    if (botIds.length === 0) {
      setUnreadCounts({})
      return
    }

    const { data: unreadData, error: unreadError } = await supabase
      .from('notifications')
      .select('bot')
      .eq('client_email', client.email)
      .eq('is_read', false)
      .in('bot', botIds)

    if (unreadError) {
      console.error('Failed to fetch unread counts:', unreadError.message)
      return
    }

    const counts = {}
    for (const row of unreadData ?? []) {
      counts[row.bot] = (counts[row.bot] ?? 0) + 1
    }
    setUnreadCounts(counts)
  }

  async function loadThread(botId) {
    const token = ++fetchTokenRef.current
    setLoading(true)
    setError(null)

    try {
      const [notifResult, ticketsResult] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .eq('client_email', client.email)
          .eq('bot', botId)
          .order('created_at', { ascending: true }),
        // Cross-referencing by a live query (rather than matching on
        // notification message text) is the reliable way to know which
        // notifications represent a ticket actually awaiting approval.
        supabase
          .from('tickets')
          .select('*')
          .eq('client_email', client.email)
          .eq('bot', botId)
          .eq('status', 'awaiting_client_approval')
          .order('created_at', { ascending: true }),
      ])

      if (fetchTokenRef.current !== token) return
      if (notifResult.error) throw new Error(notifResult.error.message)
      if (ticketsResult.error) throw new Error(ticketsResult.error.message)

      const rows = notifResult.data ?? []
      setNotifications(rows)
      setAwaitingTickets(ticketsResult.data ?? [])

      const firstUnread = rows.find((n) => !n.is_read)
      setUnreadDividerId(firstUnread?.id ?? null)

      if (firstUnread) {
        const { error: updateError } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('client_email', client.email)
          .eq('bot', botId)
          .eq('is_read', false)

        if (updateError) {
          console.error('Failed to mark notifications as read:', updateError.message)
        } else {
          // Reflect locally right away so the badge drops to 0 immediately.
          setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
          setUnreadCounts((prev) => ({ ...prev, [botId]: 0 }))
        }
      }
    } catch (err) {
      if (fetchTokenRef.current !== token) return
      setError(err.message)
    } finally {
      if (fetchTokenRef.current === token) setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchActiveBotsAndCounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.email, location.pathname])

  function handleSelectBot(botId) {
    setSelectedBotId(botId)
    setUnreadDividerId(null)
    setTicketActionState({})
    loadThread(botId)
  }

  async function handleApproveTicket(ticket) {
    const { error: updateError } = await supabase
      .from('tickets')
      .update({ status: 'approved' })
      .eq('id', ticket.id)

    if (updateError) return updateError.message

    setTicketActionState((prev) => ({ ...prev, [ticket.id]: 'approved' }))
    return null
  }

  async function handleRequestChanges(ticket, note) {
    const newSummary = `${ticket.request_summary}\n\n[Client requested changes]: ${note}`

    const { error: updateError } = await supabase
      .from('tickets')
      .update({ status: 'open', request_summary: newSummary })
      .eq('id', ticket.id)

    if (updateError) return updateError.message

    setTicketActionState((prev) => ({ ...prev, [ticket.id]: 'changes-requested' }))
    return null
  }

  function handleRefresh() {
    if (selectedBotId) {
      loadThread(selectedBotId)
    } else {
      fetchActiveBotsAndCounts()
    }
  }

  function handleReviewClick(link) {
    if (link.startsWith('http')) {
      window.open(link, '_blank', 'noopener,noreferrer')
    } else {
      navigate(link)
    }
  }

  const selectedBot = selectedBotId
    ? (BOTS[selectedBotId] ?? { name: 'Fundi', role: 'Your AI Assistant' })
    : null
  const decorativeCount = Math.max(0, TOTAL_AVATAR_SLOTS - activeBotIds.length)

  const feedItems = [
    ...notifications.map((n) => ({ kind: 'notification', key: `n-${n.id}`, createdAt: n.created_at, data: n })),
    ...awaitingTickets.map((t) => ({ kind: 'ticket', key: `t-${t.id}`, createdAt: t.created_at, data: t })),
  ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

  return (
    <div className="flex h-full gap-6 font-sans">
      <div
        className="hidden w-56 flex-shrink-0 flex-col gap-4 rounded-2xl p-4 md:flex"
        style={{ background: 'var(--fundi-gradient)' }}
      >
        <h1 className="text-lg font-bold text-white">Fundi's DM</h1>

        <div className="grid grid-cols-2 gap-3">
          {activeBotIds.map((botId) => {
            const info = BOTS[botId] ?? { name: 'Fundi' }
            const count = unreadCounts[botId] ?? 0
            return (
              <button
                key={botId}
                type="button"
                onClick={() => handleSelectBot(botId)}
                aria-label={info.name}
                className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-white text-lg font-bold text-fundi-dark transition ${
                  selectedBotId === botId ? 'ring-4 ring-fundi-green' : 'hover:opacity-90'
                }`}
              >
                {info.name.charAt(0)}
                {count > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
                    {count}
                  </span>
                )}
              </button>
            )
          })}

          {Array.from({ length: decorativeCount }).map((_, i) => (
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
            {selectedBot && (
              <>
                <h2 className="text-lg font-semibold text-fundi-dark">
                  {selectedBot.name}
                </h2>
                <p className="text-xs text-gray-500">{selectedBot.role}</p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
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
          ) : !selectedBotId ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <Bell size={32} className="text-fundi-blue" />
              <p className="text-fundi-dark">Select a Fundi to check messages</p>
            </div>
          ) : loading ? (
            <p className="mt-16 text-center text-sm text-gray-400">
              Loading messages...
            </p>
          ) : feedItems.length === 0 ? (
            <p className="mt-16 text-center text-sm text-gray-400">
              You're all caught up 🎉
            </p>
          ) : (
            <div className="space-y-1 px-1">
              {feedItems.map((item) => {
                if (item.kind === 'ticket') {
                  const ticket = item.data
                  return (
                    <div key={item.key} className="my-2">
                      <TicketApprovalCard
                        ticket={ticket}
                        botName={selectedBot.name}
                        actionState={ticketActionState[ticket.id]}
                        onApprove={handleApproveTicket}
                        onRequestChanges={handleRequestChanges}
                      />
                    </div>
                  )
                }

                const n = item.data
                return (
                  <div key={item.key}>
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
                      <BotAvatar botName={selectedBot.name} />
                      <div
                        className={`max-w-md rounded-2xl rounded-bl-sm px-4 py-2 text-white ${ASSISTANT_MARKDOWN_CLASSES}`}
                        style={{ background: 'var(--fundi-gradient)' }}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {n.message}
                        </ReactMarkdown>
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
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
