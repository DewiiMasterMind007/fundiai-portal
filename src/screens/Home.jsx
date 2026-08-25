import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useClient } from '../context/ClientContext'
import { supabase } from '../lib/supabase'
import { BOTS } from '../lib/bots'

const ROSTER = [
  { name: 'Bakkies', role: 'Customer Support' },
  { name: 'Willem', role: 'SEO Fundi' },
  { name: 'Lerato', role: 'Human Resources' },
  { name: 'Ruaan', role: 'Cyber Security' },
  { name: 'Andrew', role: 'Virtual Assistant' },
  { name: 'Luthando', role: 'Business Strategist' },
]

const SLOTS = [
  { botId: 'poppie' },
  ROSTER[0],
  { botId: 'chad' },
  ROSTER[1],
  ROSTER[2],
  ROSTER[3],
  ROSTER[4],
  ROSTER[5],
]

export default function Home() {
  const { client } = useClient()
  const navigate = useNavigate()

  const [activeBotIds, setActiveBotIds] = useState([])

  useEffect(() => {
    let cancelled = false

    async function fetchClientBots() {
      const { data, error } = await supabase
        .from('client_bots')
        .select('*')
        .eq('client_email', client.email)

      if (cancelled) return
      if (error) {
        console.error('Failed to load client bots:', error.message)
        setActiveBotIds([])
        return
      }
      setActiveBotIds((data ?? []).map((row) => row.bot))
    }

    fetchClientBots()

    return () => {
      cancelled = true
    }
  }, [client.email])

  return (
    <div className="flex h-full flex-col gap-8 overflow-y-auto font-sans">
      <div className="relative overflow-visible rounded-2xl bg-gray-100 p-6 sm:p-8">
        <div className="max-w-xl">
          <h1 className="text-2xl font-semibold text-fundi-dark">
            Hello! You're in the right place.
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Welcome to Fundi Ai Client Portal, here you'll be able to have
            real-time conversations with your AI and put them to work. The
            more info you upload to your Fundi File and your AI, the more
            your AI will scale your business.
          </p>
          <p className="mt-3 text-xs font-medium text-gray-500">
            IMPORTANT: This Interface is in Beta-Mode, issues might occur
            occasionally, please report any issues to d@fundiai.co.za
          </p>
        </div>
        <img
          src="/Mr D.png"
          alt="FundiAI founder"
          className="pointer-events-none absolute -top-8 right-4 hidden h-48 w-48 object-contain sm:block md:-top-10 md:right-8 md:h-56 md:w-56"
        />
      </div>

      <div>
        <h2 className="text-center text-3xl font-semibold text-fundi-blue">
          Welcome, ready to start?
        </h2>
        <p className="mt-6 text-base font-medium text-fundi-dark/70">
          Your AI Fundi's
        </p>

        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {SLOTS.map((slot, i) => {
            if (!slot.botId) {
              return <LockedAgentCard key={slot.name ?? i} name={slot.name} role={slot.role} />
            }

            const info = BOTS[slot.botId]
            if (activeBotIds.includes(slot.botId)) {
              return (
                <ActiveAgentCard
                  key={slot.botId}
                  agent={info}
                  onClick={() => navigate(`/chat/${slot.botId}`)}
                />
              )
            }
            return (
              <LockedAgentCard key={slot.botId} name={info.name} role={info.role} />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ActiveAgentCard({ agent, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative h-44 overflow-hidden rounded-2xl bg-gradient-to-br from-fundi-blue to-fundi-dark text-left shadow-lg transition hover:shadow-xl"
    >
      <div className="relative z-10 p-4">
        <p className="text-lg font-bold text-white">{agent.name}</p>
        <p className="text-xs text-white/80">{agent.role}</p>
      </div>
      <img
        src={agent.image}
        alt={agent.name}
        className="pointer-events-none absolute -bottom-3 -right-4 h-40 w-40 object-contain transition-transform duration-300 ease-out group-hover:scale-110"
      />
    </button>
  )
}

function LockedAgentCard({ name, role }) {
  return (
    <div className="relative flex h-44 flex-col items-center justify-center gap-2 rounded-2xl bg-fundi-bg p-4 text-center opacity-60 grayscale">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/70 text-base font-semibold text-fundi-dark/40">
        {name.charAt(0)}
      </div>
      <div>
        <p className="text-sm font-medium text-fundi-dark/50">{name}</p>
        <p className="text-xs text-fundi-dark/35">{role}</p>
      </div>
      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-lg bg-fundi-green text-white shadow">
        <Plus size={12} />
      </span>
    </div>
  )
}
