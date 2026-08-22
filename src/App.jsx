import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { ClientProvider, useClient } from './context/ClientContext'
import { supabase } from './lib/supabase'
import { detectRecoverySignal } from './lib/authRecovery'
import Sidebar from './components/Sidebar'
import Login from './screens/Login'
import SetPassword from './screens/SetPassword'
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
    <div className="flex h-screen bg-fundi-dark">
      <Sidebar />
      <div className="flex-1 rounded-l-3xl bg-fundi-bg p-6">
        <div className="h-full overflow-auto rounded-2xl bg-white p-6 shadow-sm">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

function App() {
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(() =>
    detectRecoverySignal(),
  )

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryFlow(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter>
      <ClientProvider>
        {isRecoveryFlow ? (
          <SetPassword />
        ) : (
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
          </Routes>
        )}
      </ClientProvider>
    </BrowserRouter>
  )
}

export default App
