import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { AuthForm } from './components/AuthForm'
import { UsernameClaim } from './components/UsernameClaim'
import { AppLayout } from './components/AppLayout'
import { Home } from './pages/Home'
import { Rooms } from './pages/Rooms'
import { Profile } from './pages/Profile'
import { ComingSoon } from './pages/ComingSoon'
import { RoomPage } from './pages/RoomPage'

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-svh items-center justify-center">{children}</div>
}

function AppShell() {
  const { session, profile, loading, init } = useAuthStore()

  useEffect(() => {
    init()
  }, [init])

  if (loading) {
    return (
      <Centered>
        <p className="text-zinc-400">Loading…</p>
      </Centered>
    )
  }

  if (!session) {
    return (
      <Centered>
        <AuthForm />
      </Centered>
    )
  }

  if (!profile) {
    return (
      <Centered>
        <UsernameClaim />
      </Centered>
    )
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppLayout>
            <Home />
          </AppLayout>
        }
      />
      <Route
        path="/rooms"
        element={
          <AppLayout>
            <Rooms />
          </AppLayout>
        }
      />
      <Route
        path="/chat"
        element={
          <AppLayout>
            <ComingSoon emoji="💬" title="Chat" />
          </AppLayout>
        }
      />
      <Route
        path="/friends"
        element={
          <AppLayout>
            <ComingSoon emoji="👥" title="Friends" />
          </AppLayout>
        }
      />
      <Route
        path="/profile"
        element={
          <AppLayout>
            <Profile />
          </AppLayout>
        }
      />
      <Route path="/r/:slug" element={<RoomPage />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-svh bg-zinc-950">
        <AppShell />
      </div>
    </BrowserRouter>
  )
}

export default App
