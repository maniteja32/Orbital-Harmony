import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
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

function isIOSWebKit() {
  const ua = navigator.userAgent || ''
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const webkit = /WebKit/i.test(ua)
  const notChromium = !/CriOS|EdgiOS|FxiOS|OPiOS|DuckDuckGo/i.test(ua)
  return iOS && webkit && notChromium
}

// Returning from the native share sheet (or camera/file picker) can leave
// iOS Safari/WKWebView's compositor showing a stale, partially-painted frame
// (text stuck mid-fade/low-opacity). Force a repaint only there. Applying
// this globally can itself cause white/washed frames on some Android browsers.
if (isIOSWebKit()) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    requestAnimationFrame(() => {
      const { body } = document
      body.style.display = 'none'
      void body.offsetHeight
      body.style.display = ''
    })
  })
}

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
    <Analytics />
  </StrictMode>,
)
