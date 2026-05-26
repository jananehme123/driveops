import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FileText, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function Reports() {
  const [events, setEvents]           = useState([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [report, setReport]           = useState(null)
  const [loading, setLoading]         = useState(false)

  useEffect(() => {
    supabase.from('events').select('id, name').order('name').then(({ data }) => setEvents(data || []))
  }, [])

  async function generateReport() {
    if (!selectedEvent) return
    setLoading(true)
    const [
      { data: authorised },
      { data: pending },
      { data: indemnityPending },
      { data: sessions },
      { data: vehicles },
    ] = await Promise.all([
      supabase.from('delegates').select('*').eq('event_id', selectedEvent).eq('status', 'authorised'),
      supabase.from('delegates').select('*').eq('event_id', selectedEvent).eq('status', 'pending'),
      supabase.from('delegates').select('*').eq('event_id', selectedEvent).eq('indemnity_signed', false),
      supabase.from('car_sessions')
        .select('*, vehicle:vehicles(make,model,registration), driver:delegates(first_name,last_name)')
        .eq('event_id', selectedEvent).order('started_at', { ascending: false }),
      supabase.from('vehicles').select('*').eq('event_id', selectedEvent),
    ])
    setReport({ authorised, pending, indemnityPending, sessions, vehicles })
    setLoading(false)
  }

  function duration(start, end) {
    if (!end) return 'Active'
    const diff = Math.floor((new Date(end) - new Date(start)) / 1000)
    const h = Math.floor(diff / 3600)
    const m = Math.floor((diff % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={24} color="#64748b" /> Reports
        </h1>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <select className="input" style={{ maxWidth: 320 }} value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}>
          <option value="">— Select an Event —</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
        <button className="btn btn-primary" onClick={generateReport} disabled={!selectedEvent || loading}>
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: 'Total Delegates', value: (report.authorised?.length || 0) + (report.pending?.length || 0), color: '#60a5fa' },
              { label: 'Authorised',      value: report.authorised?.length || 0, color: '#4ade80' },
              { label: 'Pending',         value: report.pending?.length || 0,    color: '#fbbf24' },
              { label: 'Total Sessions',  value: report.sessions?.length || 0,   color: '#a78bfa' },
            ].map(s => (
              <div key={s.label} className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Indemnity */}
          <div className="card">
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} /> Indemnity Status
            </h2>
            {report.indemnityPending?.length === 0 ? (
              <div style={{ color: '#4ade80', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={16} /> All delegates have signed the indemnity.
              </div>
            ) : (
              <div>
                <div style={{ color: '#fbbf24', fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={14} /> {report.indemnityPending.length} delegate(s) have NOT signed:
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Name</th><th>Email</th><th>Status</th></tr></thead>
                    <tbody>
                      {report.indemnityPending.map(d => (
                        <tr key={d.id}>
                          <td>{d.first_name} {d.last_name}</td>
                          <td>{d.email || '—'}</td>
                          <td><span className="badge badge-yellow">{d.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Car Usage */}
          <div className="card">
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} /> Car Usage History
            </h2>
            {report.sessions?.length === 0
              ? <div style={{ color: '#475569', fontSize: 14 }}>No sessions recorded.</div>
              : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Vehicle</th><th>Driver</th><th>Started</th><th>Ended</th><th>Duration</th><th>Status</th></tr></thead>
                    <tbody>
                      {report.sessions.map(s => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 500 }}>{s.vehicle?.make} {s.vehicle?.model} ({s.vehicle?.registration})</td>
                          <td>{s.driver?.first_name} {s.driver?.last_name}</td>
                          <td>{new Date(s.started_at).toLocaleTimeString()}</td>
                          <td>{s.ended_at ? new Date(s.ended_at).toLocaleTimeString() : '—'}</td>
                          <td>{duration(s.started_at, s.ended_at)}</td>
                          <td><span className={`badge ${s.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{s.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>

          {/* Vehicle Utilisation */}
          <div className="card">
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} /> Vehicle Utilisation
            </h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Vehicle</th><th>Registration</th><th>Total Sessions</th><th>Current Status</th></tr></thead>
                <tbody>
                  {report.vehicles?.map(v => {
                    const count = report.sessions?.filter(s => s.vehicle_id === v.id).length || 0
                    return (
                      <tr key={v.id}>
                        <td>{v.make} {v.model}</td>
                        <td style={{ fontFamily: 'monospace' }}>{v.registration}</td>
                        <td>{count}</td>
                        <td><span className={`badge ${v.status === 'available' ? 'badge-green' : v.status === 'in_use' ? 'badge-red' : 'badge-yellow'}`}>{v.status.replace('_',' ')}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
