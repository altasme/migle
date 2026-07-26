import { useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { AuthLanding } from './components/AuthLanding'
import { registerOAuthDeepLink } from './lib/discordAuth'
import { SplashScreen } from './components/SplashScreen'
import { WelcomeStep } from './components/WelcomeStep'
import { UsernameClaim } from './components/UsernameClaim'
import { OnboardingFlow } from './components/onboarding/OnboardingFlow'
import { AppLayout } from './components/AppLayout'
import { CreatorLetter } from './components/CreatorLetter'
import { Home } from './pages/Home'
import { Rooms } from './pages/Rooms'
import { Profile } from './pages/Profile'
import { RoomPage } from './pages/RoomPage'
import { VibeMatch } from './pages/VibeMatch'
import { Wardrobe } from './pages/Wardrobe'
import { Discover } from './pages/Discover'
import { Chat } from './pages/Chat'
import { DmThread } from './pages/DmThread'
import { FollowList } from './pages/FollowList'
import { Friends } from './pages/Friends'
import { FriendProfile } from './pages/FriendProfile'
import { BlockedUsers } from './pages/BlockedUsers'
import { AdminReports } from './pages/AdminReports'
import { ErrorBoundary } from './components/ErrorBoundary'

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-svh items-center justify-center">{children}</div>
}

function AppShell() {
  const { session, profile, loading, init } = useAuthStore()
  const [welcomed, setWelcomed] = useState(false)

  useEffect(() => {
    init()
  }, [init])

  // Registered once at the root regardless of auth state - the OAuth
  // redirect can land while the user is still on the sign-in screen.
  useEffect(() => {
    const handle = registerOAuthDeepLink()
    return () => {
      handle.then((h) => h.remove())
    }
  }, [])

  if (loading) {
    return <SplashScreen />
  }

  if (!session) {
    return <AuthLanding />
  }

  if (!profile) {
    if (!welcomed) {
      return <WelcomeStep onNext={() => setWelcomed(true)} />
    }
    return (
      <Centered>
        <UsernameClaim />
      </Centered>
    )
  }

  if (!profile.onboarded) {
    return <OnboardingFlow />
  }

  return (
    <>
      <CreatorLetter />
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
      <Route path="/vibematch" element={<VibeMatch />} />
      <Route path="/wardrobe" element={<Wardrobe />} />
      <Route path="/dm/:threadId" element={<DmThread />} />
      <Route path="/friends" element={<Friends />} />
      <Route path="/friend/:userId" element={<FriendProfile />} />
      <Route path="/followers" element={<FollowList kind="followers" />} />
      <Route path="/following" element={<FollowList kind="following" />} />
      <Route path="/blocked" element={<BlockedUsers />} />
      <Route path="/admin/reports" element={<AdminReports />} />
      </Routes>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-svh bg-zinc-950">
        <ErrorBoundary>
          <AppShell />
        </ErrorBoundary>
      </div>
    </BrowserRouter>
  )
}

export default App
