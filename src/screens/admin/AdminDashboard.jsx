import { useEffect, useState } from 'react'
import { Users, AlertTriangle, Ticket, CheckCircle2 } from 'lucide-react'
import { useAdmin } from '../../context/AdminContext'
import { supabase } from '../../lib/supabase'
import { BOTS } from '../../lib/bots'

function botIdOf(bot) {
  return typeof bot === 'string' ? bot : (bot?.bot ?? bot?.id ?? null)
}

function StatCard({ label, value, icon: Icon, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-fundi-bg p-4">
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white ${tone}`}
      >
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-semibold text-fundi-dark">{value}</p>
        <p className="text-xs text-fundi-dark/60">{label}</p>
      </div>
    </div>
  )
}

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

function ClientRow({ row }) {
  const needsAttentionCount = row.needs_attention_count ?? 0
  const bots = Array.isArray(row.bots) ? row.bots : []

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-fundi-bg p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-fundi-dark">
            {row.business_name || 'Unnamed business'}
          </p>
          {row.plan && (
            <span className="flex-shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600">
              {row.plan}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-fundi-dark/50">{row.full_name}</p>
        {bots.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {bots.map((bot) => {
              const botId = botIdOf(bot)
              return botId ? <BotBadge key={botId} botId={botId} /> : null
            })}
          </div>
        )}
      </div>

      <div className="flex-shrink-0">
        {needsAttentionCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800">
            <AlertTriangle size={13} />
            {needsAttentionCount} needs attention
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500">
            <CheckCircle2 size={13} />
            All clear
          </span>
        )}
      </div>
    </div>
  )
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-fundi-bg" />
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

export default function AdminDashboard() {
  const { admin } = useAdmin()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchOverview() {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('admin_client_overview')
        .select('*')
        .order('needs_attention_count', { ascending: false })

      if (cancelled) return

      if (fetchError) {
        setError(fetchError.message)
        setRows([])
      } else {
        setRows(data ?? [])
      }
      setLoading(false)
    }

    fetchOverview()

    return () => {
      cancelled = true
    }
  }, [])

  const totalClients = rows.length
  const needsAttentionTotal = rows.reduce(
    (sum, row) => sum + (row.needs_attention_count ?? 0),
    0,
  )
  const openTicketsTotal = rows.reduce(
    (sum, row) =>
      sum + (row.open_tickets ?? 0) + (row.in_progress_tickets ?? 0),
    0,
  )

  return (
    <div className="font-sans">
      <h1 className="text-2xl font-semibold text-fundi-dark">
        Admin Dashboard
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Welcome, {admin?.full_name}.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <StatCard
          label="Total Clients"
          value={totalClients}
          icon={Users}
          tone="bg-fundi-blue"
        />
        <StatCard
          label="Needs Attention"
          value={needsAttentionTotal}
          icon={AlertTriangle}
          tone="bg-amber-500"
        />
        <StatCard
          label="Open Tickets"
          value={openTicketsTotal}
          icon={Ticket}
          tone="bg-fundi-dark"
        />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-fundi-dark/70">
        Clients
      </h2>

      {error ? (
        <ErrorBox message={error} />
      ) : loading ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <p className="mt-16 text-center text-sm text-gray-400">
          No clients yet
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <ClientRow key={row.client_email ?? row.id ?? i} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}
