import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Catches render errors in production (React swallows them silently otherwise)
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('App render error:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div className="loading-screen">
          <div className="empty-icon">💥</div>
          <h2 style={{ color: 'var(--red)', marginBottom: 8 }}>Chyba aplikácie</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 340, textAlign: 'center' }}>
            {String(this.state.error)}
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
