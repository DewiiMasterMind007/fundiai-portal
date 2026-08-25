import { Link, useLocation } from 'react-router-dom'
import { Bell, Home, Folder, Calendar } from 'lucide-react'
import { useUnreadCount } from '../context/useUnreadCount'

const tabs = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/workspace', icon: Folder, label: 'Workspace' },
  { to: '/schedule', icon: Calendar, label: 'Schedule' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
]

export default function MobileBottomNav() {
  const location = useLocation()
  const unreadCount = useUnreadCount()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-gray-200 bg-white font-sans md:hidden">
      {tabs.map(({ to, icon: Icon, label }) => {
        const isActive = location.pathname === to
        return (
          <Link
            key={to}
            to={to}
            aria-label={label}
            className={`relative flex h-full flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${
              isActive ? 'text-fundi-blue' : 'text-gray-400'
            }`}
          >
            <Icon size={22} />
            {Icon === Bell && unreadCount > 0 && (
              <span className="absolute right-[calc(50%-18px)] top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {unreadCount}
              </span>
            )}
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
