import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, Ticket, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/clients', icon: Users, label: 'Clients' },
  { to: '/admin/tickets', icon: Ticket, label: 'Tickets' },
]

export default function AdminSidebar() {
  const location = useLocation()

  return (
    <nav className="flex h-full w-20 flex-col items-center bg-fundi-dark py-6 font-sans">
      <img
        src="/HorizontalLogo_FundiAI.png"
        alt="FundiAI"
        className="mb-8 h-8 w-8 flex-shrink-0 object-contain"
      />

      <div className="flex flex-1 flex-col items-center gap-6">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to

          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                isActive
                  ? 'bg-fundi-blue text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={20} />
            </Link>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        aria-label="Log out"
        className="mb-3 mt-6 flex h-9 w-9 items-center justify-center rounded-xl text-white/60 transition hover:bg-white/10 hover:text-white"
      >
        <LogOut size={18} />
      </button>

      <div
        aria-hidden="true"
        className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/20 bg-white/10 text-sm font-semibold text-white"
      >
        FA
      </div>
    </nav>
  )
}
