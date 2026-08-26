import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useClient } from './context/ClientContext'
import { MobileChromeProvider, useMobileChrome } from './context/MobileChromeContext'
import Sidebar from './components/Sidebar'
import MobileTopBar from './components/MobileTopBar'
import MobileBottomNav from './components/MobileBottomNav'
import Login from './screens/Login'
import Home from './screens/Home'
import Chat from './screens/Chat'
import Workspace from './screens/Workspace'
import Notifications from './screens/Notifications'
import Schedule from './screens/Schedule'
import ReviewLink from './screens/ReviewLink'
import ScheduleReviewLink from './screens/ScheduleReviewLink'

const SESSION_EXPIRED_REDIRECT_DELAY_MS = 1500

function ChatIndexRedirect() {
  const { client } = useClient()
  return <Navigate to={`/chat/${client.bot_assigned}`} replace />
}

function AppShell() {
  const { session, error, loading } = useClient()
  const [redirectToLogin, setRedirectToLogin] = useState(false)

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(
      () => setRedirectToLogin(true),
      SESSION_EXPIRED_REDIRECT_DELAY_MS,
    )
    return () => clearTimeout(timer)
  }, [error])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-fundi-bg font-sans text-fundi-dark">
        Loading...
      </div>
    )
  }

  if (error) {
    if (redirectToLogin) {
      return <Navigate to="/login" replace />
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-fundi-bg p-4 font-sans">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <p className="text-fundi-dark">
            Your session expired — redirecting you to log in...
          </p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return (
    <MobileChromeProvider>
      <AppShellLayout />
    </MobileChromeProvider>
  )
}

function AppShellLayout() {
  const { hideBottomNav } = useMobileChrome()

  return (
    <div className="flex h-screen flex-col bg-fundi-dark md:flex-row">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <MobileTopBar />
      <div className="min-h-0 flex-1 bg-fundi-bg md:rounded-l-3xl md:p-6">
        <div
          className={`h-full overflow-auto bg-white p-4 shadow-sm md:rounded-2xl md:p-6 md:pb-6 ${
            hideBottomNav ? 'pb-4' : 'pb-20'
          }`}
        >
          <Outlet />
        </div>
      </div>
      <MobileBottomNav />
    </div>
  )
}

export default function ClientApp() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/review/:reviewId" element={<ReviewLink />} />
      <Route
        path="/schedule-review/:reviewId"
        element={<ScheduleReviewLink />}
      />
      <Route path="/" element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="chat" element={<ChatIndexRedirect />} />
        <Route path="chat/:botId" element={<Chat />} />
        <Route path="workspace" element={<Workspace />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="schedule" element={<Schedule />} />
      </Route>
      {/* Any unmatched path (e.g. "/admin" left over from an admin
          session that just logged out) falls back to Home, where
          AppShell's own session check takes over from there. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
