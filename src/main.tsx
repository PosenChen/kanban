import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Debug: Check if we're rendering
console.log('DEBUG: App starting...')
try {
  const root = ReactDOM.createRoot(document.getElementById('root')!)
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
    root.innerHTML = '<div style="padding:20px;color:red;font-family:sans-serif;"><h1>App Error</h1><pre>' + String(err) + '</pre></div>'
  }
}
