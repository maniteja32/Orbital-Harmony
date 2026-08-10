import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './shadcn.css'
import './index.css'
import App from './App.jsx'

const CHUNK_RELOAD_KEY = 'space-harmony:chunk-reload'

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0)
  if (Date.now() - lastReload > 10_000) {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
    window.location.reload()
  }
})

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="app-fatal" role="alert">
          <h1>Space Harmony needs a refresh</h1>
          <p>A new version may have arrived while this page was open.</p>
          <button type="button" onClick={() => window.location.reload()}>Reload Space Harmony</button>
        </main>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
