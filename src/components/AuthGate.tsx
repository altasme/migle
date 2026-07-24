import { useState } from 'react'
import { AuthLanding } from './AuthLanding'
import { AuthForm } from './AuthForm'
import { SignUpFlow } from './SignUpFlow'

export function AuthGate() {
  const [mode, setMode] = useState<'landing' | 'signup' | 'login'>('landing')

  if (mode === 'landing') {
    return <AuthLanding onPick={setMode} />
  }

  if (mode === 'signup') {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <SignUpFlow onBack={() => setMode('landing')} onSwitchToLogin={() => setMode('login')} />
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center">
      <AuthForm onBack={() => setMode('landing')} onSwitchToSignup={() => setMode('signup')} />
    </div>
  )
}
