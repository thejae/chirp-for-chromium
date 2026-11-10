import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'react-feather'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Top-level React error boundary preventing white-screen crashes in the popup.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React Error in Chirp3 Extension:', error, errorInfo)
  }

  private handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{ width: 586, height: 550 }}
          className="bg-neutral-50 p-6 flex flex-col items-center justify-center text-center text-neutral-800"
        >
          <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-3">
            <AlertTriangle size={24} />
          </div>
          <h1 className="text-sm font-bold text-neutral-900 mb-1">
            Something went wrong
          </h1>
          <p className="text-xs text-neutral-500 max-w-xs mb-4 leading-relaxed">
            {this.state.error?.message ||
              'An unexpected error occurred while rendering the extension.'}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors shadow-xs"
          >
            <RefreshCw size={12} />
            Reload popup
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
