import { createContext, useContext, useState } from 'react'

// Lets a mobile drill-down screen (Chat, Notifications) replace M1's
// generic top bar with a back-button header and hide the bottom tab
// bar while a thread is open — without AppShell needing to know
// anything about each screen's own selection state.
const MobileChromeContext = createContext(null)

export function MobileChromeProvider({ children }) {
  const [header, setHeader] = useState(null) // { onBack, avatarLabel, title } | null
  const [hideBottomNav, setHideBottomNav] = useState(false)

  return (
    <MobileChromeContext.Provider
      value={{ header, setHeader, hideBottomNav, setHideBottomNav }}
    >
      {children}
    </MobileChromeContext.Provider>
  )
}

export function useMobileChrome() {
  const context = useContext(MobileChromeContext)
  if (context === null) {
    throw new Error('useMobileChrome must be used within a MobileChromeProvider')
  }
  return context
}
