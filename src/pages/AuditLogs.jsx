import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Search, RefreshCw } from 'lucide-react'

export default function AuditLogs() {
  const [logs, setLogs]           = useState([])
  const [events, setEvents]       = useState([])
  const [filterEvent, setFilterEvent] = useState('')
  const [loading, setLoading]     = useState(true)

  async function load() {
    setLoading(true)
    let query = supabase.from('audit_logs')
      .select('*, event:events(name)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (filterEvent) query = query.eq('event_id', filterEvent)

    const [{ data: logsData }, { data: eventsData }] = await Promise.all([
      query,
      supabase.from('events').select('id, name').order('name'),
    ])
    setLogs(logsData || []); setEvents(eventsData || []); setLoading(false)
  }

  useEffect(() => { load() }, [filterEvent])

  const actionColors = {
    SESSION_STARTED: 'badge-green',
    SESSION_ENDED: 'badge-blue',
    VEHICLE_ADDED: 'badge-yellow',
    DELEGATE_ADDED: 'badge-yellow',
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Search size={24} color="#64748b" /> Audit Logs
        </h1>
        <button className="btn btn-ghost" onClick={load} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <select className="input" style={{ maxWidth: 280 }} value={filterEvent} onChange={e => setFilterEvent(e.target.value)}>
          <option value="">All Events</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
      </div>

      <div className="card">
        {loading ? <div style={{ color: '#475569', padding: 20, textAlign: 'center' }}>Loading...</div>
        : logs.length === 0 ? <div style={{ color: '#475569', padding: 20, textAlign: 'center' }}>No audit logs yet.</div>
        : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Time</th><th>Event</th><th>Action</th><th>Details</th></tr></thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>{new Date(log.created_at).toLocaleString()}</td>
                    <td>{log.event?.name || '—'}</td>
                    <td><span className={`badge ${actionColors[log.action] || 'badge-gray'}`}>{log.action}</span></td>
                    <td style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{log.details ? JSON.stringify(log.details).slice(0, 80) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
