import { Info } from 'lucide-react'

const AGENT_COPY = {
  poppie: { name: 'Poppie', role: 'Social Media Fundi' },
  chad: { name: 'Chad', role: 'Website & SEO Fundi' },
}

export default function AgentCard({ botAssigned }) {
  const agent = AGENT_COPY[botAssigned] ?? { name: 'Fundi', role: 'Your AI Assistant' }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-fundi-blue to-fundi-dark p-6 font-sans text-white shadow-lg">
      <button
        type="button"
        aria-label="More info"
        className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30"
      >
        <Info size={16} />
      </button>
      <p className="text-xl font-bold">{agent.name}</p>
      <p className="text-sm text-white/80">{agent.role}</p>
    </div>
  )
}
