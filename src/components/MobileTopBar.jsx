import { ArrowLeft, LogOut } from 'lucide-react'
import { useClient } from '../context/ClientContext'
import { useMobileChrome } from '../context/MobileChromeContext'

export default function MobileTopBar() {
  const { signOut } = useClient()
  const { header } = useMobileChrome()

  if (header) {
    return (
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 font-sans md:hidden">
        <button
          type="button"
          onClick={header.onBack}
          aria-label="Back"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-fundi-dark transition hover:bg-fundi-bg"
        >
          <ArrowLeft size={20} />
        </button>
        {header.avatarLabel && (
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-fundi-dark text-xs font-semibold text-white">
            {header.avatarLabel}
          </div>
        )}
        <p className="truncate text-sm font-semibold text-fundi-dark">
          {header.title}
        </p>
      </div>
    )
  }

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
