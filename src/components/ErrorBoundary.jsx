import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
    this.handleReset = this.handleReset.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught an error:', error, info)
  }

  handleReset() {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state

    if (error) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center p-6 font-sans">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
            <h1 className="mb-4 text-xl font-semibold text-fundi-dark">
              Something went wrong loading this screen
            </h1>
            <pre className="mb-4 overflow-auto rounded-lg bg-red-50 p-3 text-left font-mono text-xs text-red-600">
              {error.message || String(error)}
            </pre>
            <button
              type="button"
              onClick={this.handleReset}
              className="rounded-full bg-fundi-blue px-6 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
