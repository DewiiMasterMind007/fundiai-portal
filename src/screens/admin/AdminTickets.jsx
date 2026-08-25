import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatDistanceToNowStrict } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { BOTS } from '../../lib/bots'
import { TICKET_STATUSES } from '../../lib/ticketStatus'

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'awaiting_client_approval', label: 'Awaiting Client Approval' },
  { id: 'approved', label: 'Approved' },
]

function BotBadge({ botId }) {
  const info = BOTS[botId]
  if (!info) return null

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
      style={{ backgroundColor: info.color }}
    >
      {info.name}
    </span>
  )
}

function StatusBadge({ status }) {
  const info = TICKET_STATUSES[status] ?? {
    label: status || 'Unknown',
    color: 'bg-gray-200 text-gray-700',
  }
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${info.color}`}
    >
      {info.label}
    </span>
  )
}

function TicketActions({ ticket, onUpdate, updating }) {
  if (ticket.status === 'open') {
    return (
      <button
        type="button"
        disabled={updating}
        onClick={() => onUpdate(ticket, 'in_progress')}
        className="rounded-full bg-fundi-blue px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        Mark In Progress
      </button>
    )
  }

  if (ticket.status === 'in_progress') {
    return (
      <button
        type="button"
        disabled={updating}
        onClick={() => onUpdate(ticket, 'completed')}
        className="rounded-full bg-fundi-green px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        Mark Completed
      </button>
    )
  }

  if (ticket.status === 'awaiting_client_approval') {
    return (
      <span className="text-xs font-medium text-fundi-dark/40">
        Waiting on client response
      </span>
    )
  }

  if (ticket.status === 'approved') {
    return (
      <span className="text-xs font-medium text-fundi-green">
        ✅ Approved by client
      </span>
    )
  }

  return null
}

function TicketCard({ ticket, onUpdate, updating, updateError }) {
  return (
    <div className="rounded-2xl bg-fundi-bg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-fundi-dark">
              {ticket.client_email}
            </p>
            <BotBadge botId={ticket.bot} />
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-fundi-dark/80">
            {ticket.request_summary}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {ticket.created_at &&
              formatDistanceToNowStrict(new Date(ticket.created_at), {
                addSuffix: true,
              })}
          </p>
        </div>

        <div className="flex flex-shrink-0 flex-col items-end gap-2">
          <StatusBadge status={ticket.status} />
          <TicketActions ticket={ticket} onUpdate={onUpdate} updating={updating} />
        </div>
      </div>

      {updateError && (
        <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-600">
          {updateError}
        </div>
      )}
    </div>
  )
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl bg-fundi-bg" />
      ))}
    </div>
  )
}

function ErrorBox({ message }) {
  return (
    <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
      {message}
    </div>
  )
}

export default function AdminTickets() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingIds, setUpdatingIds] = useState({})
  const [updateErrors, setUpdateErrors] = useState({})

  const [statusFilter, setStatusFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState(searchParams.get('client') || 'all')

  useEffect(() => {
    let cancelled = false

    async function fetchTickets() {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (fetchError) {
        setError(fetchError.message)
        setTickets([])
      } else {
        setTickets(data ?? [])
      }
      setLoading(false)
    }

    fetchTickets()

    return () => {
      cancelled = true
    }
  }, [])

  const clientEmails = useMemo(() => {
    const set = new Set(tickets.map((t) => t.client_email).filter(Boolean))
    return Array.from(set).sort()
  }, [tickets])

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const statusMatch =
        statusFilter === 'all' ? t.status !== 'approved' : t.status === statusFilter
      const clientMatch = clientFilter === 'all' || t.client_email === clientFilter
      return statusMatch && clientMatch
    })
  }, [tickets, statusFilter, clientFilter])

  function handleClientFilterChange(value) {
    setClientFilter(value)
    const next = new URLSearchParams(searchParams)
    if (value === 'all') {
      next.delete('client')
    } else {
      next.set('client', value)
    }
    setSearchParams(next, { replace: true })
  }

  async function handleUpdateStatus(ticket, newStatus) {
    setUpdatingIds((prev) => ({ ...prev, [ticket.id]: true }))
    setUpdateErrors((prev) => ({ ...prev, [ticket.id]: null }))

    const { error: updateError } = await supabase
      .from('tickets')
      .update({ status: newStatus })
      .eq('id', ticket.id)

    if (updateError) {
      setUpdateErrors((prev) => ({ ...prev, [ticket.id]: updateError.message }))
      setUpdatingIds((prev) => ({ ...prev, [ticket.id]: false }))
      return
    }

    setTickets((prev) =>
      prev.map((t) => (t.id === ticket.id ? { ...t, status: newStatus } : t)),
    )

    if (newStatus !== 'completed') {
      setUpdatingIds((prev) => ({ ...prev, [ticket.id]: false }))
      return
    }

    // "Completed" is transient — it immediately advances to
    // "awaiting_client_approval" and notifies the client, with no
    // separate button for that step.
    const { error: advanceError } = await supabase
      .from('tickets')
      .update({ status: 'awaiting_client_approval' })
      .eq('id', ticket.id)

    if (advanceError) {
      setUpdateErrors((prev) => ({ ...prev, [ticket.id]: advanceError.message }))
      setUpdatingIds((prev) => ({ ...prev, [ticket.id]: false }))
      return
    }

    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticket.id ? { ...t, status: 'awaiting_client_approval' } : t,
      ),
    )

    const { error: notifyError } = await supabase.from('notifications').insert({
      client_email: ticket.client_email,
      bot: ticket.bot,
      message: `Your request "${ticket.request_summary}" is ready for your review.`,
      link: '/notifications',
    })

    if (notifyError) {
      setUpdateErrors((prev) => ({ ...prev, [ticket.id]: notifyError.message }))
    }
    setUpdatingIds((prev) => ({ ...prev, [ticket.id]: false }))
  }

  return (
    <div className="font-sans">
      <h1 className="text-2xl font-semibold text-fundi-dark">Tickets</h1>
      <p className="mt-1 text-sm text-gray-500">
        Track and action client requests.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatusFilter(filter.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === filter.id
                  ? 'bg-fundi-blue text-white'
                  : 'bg-fundi-bg text-fundi-dark hover:bg-fundi-bg/70'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <select
          value={clientFilter}
          onChange={(e) => handleClientFilterChange(e.target.value)}
          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-fundi-dark outline-none focus:border-fundi-blue"
        >
          <option value="all">All clients</option>
          {clientEmails.map((email) => (
            <option key={email} value={email}>
              {email}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        {error ? (
          <ErrorBox message={error} />
        ) : loading ? (
          <SkeletonRows />
        ) : filteredTickets.length === 0 ? (
          <p className="mt-16 text-center text-sm text-gray-400">No tickets</p>
        ) : (
          <div className="space-y-2">
            {filteredTickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onUpdate={handleUpdateStatus}
                updating={!!updatingIds[ticket.id]}
                updateError={updateErrors[ticket.id]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
