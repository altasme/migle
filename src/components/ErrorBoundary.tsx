import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

// Without this, an uncaught render error anywhere in the tree unmounts
// everything and leaves a silent blank screen - no message, nothing in the
// UI to go on, only a stack trace in a console nobody's looking at on a
// phone. This turns that into a visible, recoverable screen instead.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Uncaught render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-zinc-950 p-6 text-center">
          <span className="text-4xl">😵</span>
          <h1 className="text-lg font-semibold text-white">Something went wrong</h1>
          <p className="max-w-xs text-sm text-zinc-400">
            {this.state.error.message || 'The app hit an unexpected error.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-purple-600 px-5 py-2.5 text-sm font-medium text-white"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
