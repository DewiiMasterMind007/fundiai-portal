import { LogOut } from 'lucide-react'
import { useClient } from '../context/ClientContext'

export default function MobileTopBar() {
  const { signOut } = useClient()

  return (
    <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 font-sans md:hidden">
      <img
        src="/HorizontalLogo_FundiAI.png"
        alt="FundiAI"
        className="h-7 w-7 object-contain"
      />
      <button
        type="button"
        onClick={signOut}
        aria-label="Log out"
        className="flex h-9 w-9 items-center justify-center rounded-full text-fundi-dark transition hover:bg-fundi-bg"
      >
        <LogOut size={18} />
      </button>
    </div>
  )
}
