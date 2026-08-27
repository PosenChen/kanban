import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

try {
  const rootEl = document.getElementById('root')
  if (!rootEl) throw new Error('root element not found')
  const root = ReactDOM.createRoot(rootEl)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
} catch (err) {
  console.error('Fatal error during app initialization:', err)
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = '<div style="padding:20px;color:red;font-family:sans-serif;"><h1>App Error</h1><pre style="white-space:pre-wrap;word-break:break-word;">' + String(err) + '</pre></div>'
  }
}