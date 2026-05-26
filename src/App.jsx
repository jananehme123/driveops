import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Events from './pages/Events'
import Delegates from './pages/Delegates'
import Vehicles from './pages/Vehicles'
import Operations from './pages/Operations'
import Reports from './pages/Reports'
import AuditLogs from './pages/AuditLogs'

// Protects pages — redirects to /login if not signed in
function ProtectedRoute({ session, children }) {
  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    // Get current session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    // Listen for login/logout changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Still checking auth — show nothing
  if (session === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ color: '#64748b', fontSize: 18 }}>Loading DriveOps...</div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />

        {/* Protected routes — all wrapped in Layout (sidebar) */}
        <Route path="/" element={
          <ProtectedRoute session={session}>
            <Layout session={session} />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="clients" element={<Clients />} />
          <Route path="events" element={<Events />} />
          <Route path="delegates" element={<Delegates />} />
          <Route path="vehicles" element={<Vehicles />} />
          <Route path="operations" element={<Operations />} />
          <Route path="reports" element={<Reports />} />
          <Route path="audit-logs" element={<AuditLogs />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
