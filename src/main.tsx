import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Very early console log to verify bundle execution
console.log('DEBUG-BUNDLE-START: main.tsx module executing')

// Pre-render a loading indicator
const rootEl = document.getElementById('root')
if (rootEl) {
  rootEl.innerHTML = '<div style="padding:20px;font-family:sans-serif;color:#666;">Loading Kanban board...</div>'
}

// Debug: Check if we're rendering
console.log('DEBUG: App starting...')
console.log('DEBUG: rootEl:', rootEl)
try {
  const root = ReactDOM.createRoot(rootEl!)
  console.log('DEBUG: createRoot successful')
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
  console.log('DEBUG: render complete')
} catch (err) {
  console.error('DEBUG: Fatal error', err)
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = '<div style="padding:20px;color:red;font-family:sans-serif;"><h1>App Error</h1><pre style="white-space:pre-wrap;word-break:break-word;">' + String(err) + '</pre></div>'
  }
}