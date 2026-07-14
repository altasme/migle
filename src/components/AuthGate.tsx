import { useState } from 'react'
import { AuthLanding } from './AuthLanding'
import { AuthForm } from './AuthForm'

export function AuthGate() {
  const [mode, setMode] = useState<'landing' | 'signup' | 'login'>('landing')

  if (mode === 'landing') {
    return <AuthLanding onPick={setMode} />
  }

  return (
    <div className="flex min-h-svh items-center justify-center">
      <AuthForm initialMode={mode} onBack={() => setMode('landing')} />
    </div>
  )
}
