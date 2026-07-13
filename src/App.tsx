import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { AuthForm } from './components/AuthForm'
import { UsernameClaim } from './components/UsernameClaim'
import { Home } from './pages/Home'
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
          <Centered>
            <Home />
          </Centered>
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
