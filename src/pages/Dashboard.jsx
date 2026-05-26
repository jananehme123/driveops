import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CheckCircle2, XCircle, UserCheck, Clock, RefreshCw, Activity } from 'lucide-react'

function StatCard({ label, value, color, Icon }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
        <Icon size={28} color={color} />
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{label}</div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats]     = useState({ available: 0, inUse: 0, ready: 0, pending: 0 })
  const [feed, setFeed]       = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [
      { count: available },
      { count: inUse },
      { count: ready },
      { count: pending },
      { data: sessions },
    ] = await Promise.all([
      supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('status', 'available'),
      supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('status', 'in_use'),
      supabase.from('delegates').select('*', { count: 'exact', head: true }).eq('status', 'authorised').eq('indemnity_signed', true),
      supabase.from('delegates').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('car_sessions')
        .select('*, vehicle:vehicles(make,model,registration), driver:delegates(first_name,last_name)')
        .order('started_at', { ascending: false })
        .limit(10),
    ])
    setStats({ available: available || 0, inUse: inUse || 0, ready: ready || 0, pending: pending || 0 })
    setFeed(sessions || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function timeAgo(date) {
    const diff = Math.floor((Date.now() - new Date(date)) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`
    return `${Math.floor(diff/3600)}h ago`
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Operational Dashboard</h1>
        <button className="btn btn-ghost" onClick={load} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} /> {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard label="Available Cars"     value={stats.available} color="#4ade80" Icon={CheckCircle2} />
        <StatCard label="Cars In Use"        value={stats.inUse}     color="#f87171" Icon={XCircle} />
        <StatCard label="Ready Drivers"      value={stats.ready}     color="#60a5fa" Icon={UserCheck} />
        <StatCard label="Pending Delegates"  value={stats.pending}   color="#fbbf24" Icon={Clock} />
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={16} color="#ef4444" /> Live Activity Feed
        </h2>
        {loading ? (
          <div style={{ color: '#475569', padding: '20px 0', textAlign: 'center' }}>Loading...</div>
        ) : feed.length === 0 ? (
          <div style={{ color: '#475569', padding: '20px 0', textAlign: 'center' }}>
            No sessions yet. Head to Operations to start assigning cars.
          </div>
        ) : feed.map(session => (
          <div key={session.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: '1px solid #1e293b' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: session.status === 'active' ? '#4ade80' : '#475569', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: '#f1f5f9', fontWeight: 500 }}>
                {session.driver?.first_name} {session.driver?.last_name} → {session.vehicle?.make} {session.vehicle?.model} ({session.vehicle?.registration})
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                Started {timeAgo(session.started_at)}
                {session.ended_at && ` · Ended ${timeAgo(session.ended_at)}`}
              </div>
            </div>
            <span className={`badge ${session.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{session.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
