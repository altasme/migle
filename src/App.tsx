import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { AuthGate } from './components/AuthGate'
import { SplashScreen } from './components/SplashScreen'
import { UsernameClaim } from './components/UsernameClaim'
import { AppLayout } from './components/AppLayout'
import { Home } from './pages/Home'
import { Rooms } from './pages/Rooms'
import { Profile } from './pages/Profile'
import { RoomPage } from './pages/RoomPage'
import { Wardrobe } from './pages/Wardrobe'
import { Discover } from './pages/Discover'
import { Chat } from './pages/Chat'
import { DmThread } from './pages/DmThread'
import { Leaderboard } from './pages/Leaderboard'
import { BlockedUsers } from './pages/BlockedUsers'
import { AdminReports } from './pages/AdminReports'

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-svh items-center justify-center">{children}</div>
}

function AppShell() {
  const { session, profile, loading, init } = useAuthStore()

  useEffect(() => {
    init()
  }, [init])

  if (loading) {
    return <SplashScreen />
  }

  if (!session) {
    return <AuthGate />
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
            <Chat />
          </AppLayout>
        }
      />
      <Route
        path="/discover"
        element={
          <AppLayout>
            <Discover />
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
      <Route path="/wardrobe" element={<Wardrobe />} />
      <Route path="/dm/:threadId" element={<DmThread />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/blocked" element={<BlockedUsers />} />
      <Route path="/admin/reports" element={<AdminReports />} />
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
