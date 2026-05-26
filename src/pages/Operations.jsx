import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Car, RefreshCw, Timer, Play, RotateCcw } from 'lucide-react'

export default function Operations() {
  const [events, setEvents]             = useState([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [availableCars, setAvailableCars] = useState([])
  const [activeSessions, setActiveSessions] = useState([])
  const [readyDelegates, setReadyDelegates] = useState([])
  const [loading, setLoading]           = useState(false)
  const [search, setSearch]             = useState('')
  const [showAssign, setShowAssign]     = useState(false)
  const [assignCar, setAssignCar]       = useState(null)
  const [assignDriver, setAssignDriver] = useState('')
  const [assignPassengers, setAssignPassengers] = useState([])
  const [assigning, setAssigning]       = useState(false)
  const [assignError, setAssignError]   = useState('')

  async function loadEvents() {
    const { data } = await supabase.from('events').select('id, name').order('name')
    setEvents(data || [])
  }

  async function loadOperations() {
    if (!selectedEvent) return
    setLoading(true)
    const [{ data: cars }, { data: sessions }, { data: delegates }] = await Promise.all([
      supabase.from('vehicles').select('*').eq('event_id', selectedEvent).eq('status', 'available'),
      supabase.from('car_sessions')
        .select('*, vehicle:vehicles(make,model,registration,color), driver:delegates(first_name,last_name)')
        .eq('event_id', selectedEvent).eq('status', 'active'),
      supabase.from('delegates').select('*').eq('event_id', selectedEvent).eq('status', 'authorised').eq('indemnity_signed', true),
    ])
    setAvailableCars(cars || [])
    setActiveSessions(sessions || [])
    setReadyDelegates(delegates || [])
    setLoading(false)
  }

  useEffect(() => { loadEvents() }, [])
  useEffect(() => { loadOperations() }, [selectedEvent])

  const searchResults = search.length > 1
    ? readyDelegates.filter(d => `${d.first_name} ${d.last_name}`.toLowerCase().includes(search.toLowerCase()) || (d.email || '').toLowerCase().includes(search.toLowerCase()))
    : []

  function openAssign(car) {
    setAssignCar(car); setAssignDriver(''); setAssignPassengers([]); setAssignError(''); setShowAssign(true)
  }

  function togglePassenger(id) {
    setAssignPassengers(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  async function handleStartSession() {
    if (!assignDriver) { setAssignError('Please select a driver.'); return }
    setAssigning(true); setAssignError('')

    const { data: existing } = await supabase.from('car_sessions').select('id').eq('driver_id', assignDriver).eq('status', 'active')
    if (existing && existing.length > 0) { setAssignError('This delegate is already in an active session.'); setAssigning(false); return }

    const { data: session, error } = await supabase.from('car_sessions')
      .insert({ event_id: selectedEvent, vehicle_id: assignCar.id, driver_id: assignDriver })
      .select().single()

    if (error) { setAssignError(error.message); setAssigning(false); return }

    if (assignPassengers.length > 0) {
      await supabase.from('session_passengers').insert(assignPassengers.map(pid => ({ session_id: session.id, delegate_id: pid })))
    }

    await supabase.from('vehicles').update({ status: 'in_use' }).eq('id', assignCar.id)
    await supabase.from('audit_logs').insert({ event_id: selectedEvent, action: 'SESSION_STARTED', details: { session_id: session.id, vehicle_id: assignCar.id, driver_id: assignDriver } })

    setAssigning(false); setShowAssign(false); loadOperations()
  }

  async function returnVehicle(session) {
    if (!confirm(`Return ${session.vehicle?.make} ${session.vehicle?.model} (${session.vehicle?.registration})?`)) return
    await supabase.from('car_sessions').update({ status: 'completed', ended_at: new Date().toISOString() }).eq('id', session.id)
    await supabase.from('vehicles').update({ status: 'available' }).eq('id', session.vehicle_id)
    await supabase.from('audit_logs').insert({ event_id: selectedEvent, action: 'SESSION_ENDED', details: { session_id: session.id, vehicle_id: session.vehicle_id } })
    loadOperations()
  }

  function timeSince(date) {
    const diff = Math.floor((Date.now() - new Date(date)) / 1000)
    if (diff < 60) return `${diff}s`
    if (diff < 3600) return `${Math.floor(diff/60)}m`
    return `${Math.floor(diff/3600)}h ${Math.floor((diff % 3600)/60)}m`
  }

  const passengerOptions = readyDelegates.filter(d => d.id !== assignDriver)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Car size={24} color="#64748b" /> On-Site Operations
        </h1>
        <button className="btn btn-ghost" onClick={loadOperations} disabled={loading || !selectedEvent}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <select className="input" style={{ maxWidth: 320, fontSize: 15 }} value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}>
          <option value="">— Select an Event —</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
      </div>

      {!selectedEvent ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: '#475569' }}>
          Select an event above to start operations.
        </div>
      ) : (
        <>
          {/* Search delegate */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Search size={14} /> Search Delegate
            </h2>
            <input className="input" placeholder="Type delegate name to search..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 400 }} />
            {search.length > 1 && (
              <div style={{ marginTop: 10 }}>
                {searchResults.length === 0 ? (
                  <div style={{ color: '#475569', fontSize: 13 }}>No matching authorised delegates found.</div>
                ) : searchResults.map(d => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #1e293b' }}>
                    <span style={{ fontSize: 14, color: '#f1f5f9', fontWeight: 500 }}>{d.first_name} {d.last_name}</span>
                    <span className="badge badge-green">Authorised</span>
                    {d.indemnity_signed && <span className="badge badge-blue">Indemnity Signed</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Available Cars */}
            <div className="card">
              <h2 style={{ fontSize: 13, fontWeight: 600, color: '#4ade80', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
                Available Cars ({availableCars.length})
              </h2>
              {loading ? <div style={{ color: '#475569' }}>Loading...</div>
              : availableCars.length === 0 ? <div style={{ color: '#475569', fontSize: 13 }}>No available cars.</div>
              : availableCars.map(car => (
                <div key={car.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1e293b' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{car.make} {car.model}</div>
                    <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{car.registration} · {car.color}</div>
                  </div>
                  <button className="btn btn-green" style={{ padding: '6px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => openAssign(car)}>
                    <Play size={12} /> Assign
                  </button>
                </div>
              ))}
            </div>

            {/* Active Sessions */}
            <div className="card">
              <h2 style={{ fontSize: 13, fontWeight: 600, color: '#f87171', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171' }} />
                Active Sessions ({activeSessions.length})
              </h2>
              {loading ? <div style={{ color: '#475569' }}>Loading...</div>
              : activeSessions.length === 0 ? <div style={{ color: '#475569', fontSize: 13 }}>No active sessions.</div>
              : activeSessions.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1e293b' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#f1f5f9' }}>
                      {s.vehicle?.make} {s.vehicle?.model}
                      <span style={{ fontFamily: 'monospace', fontWeight: 400, fontSize: 12, color: '#64748b', marginLeft: 8 }}>{s.vehicle?.registration}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Driver: {s.driver?.first_name} {s.driver?.last_name}</div>
                    <div style={{ fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Timer size={11} /> {timeSince(s.started_at)} elapsed
                    </div>
                  </div>
                  <button className="btn btn-red" style={{ padding: '6px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => returnVehicle(s)}>
                    <RotateCcw size={12} /> Return
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Quick Assign Modal */}
      {showAssign && assignCar && (
        <div className="modal-overlay" onClick={() => setShowAssign(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#f1f5f9' }}>Quick Assign</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>{assignCar.make} {assignCar.model} — {assignCar.registration}</p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Select Driver *</label>
              <select className="input" value={assignDriver} onChange={e => setAssignDriver(e.target.value)}>
                <option value="">— Choose authorised delegate —</option>
                {readyDelegates.map(d => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}
              </select>
              {readyDelegates.length === 0 && (
                <p style={{ fontSize: 12, color: '#f87171', marginTop: 6 }}>No authorised delegates with signed indemnity available.</p>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Add Passengers (optional)</label>
              <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #334155', borderRadius: 8, padding: 8 }}>
                {passengerOptions.length === 0
                  ? <div style={{ color: '#475569', fontSize: 13, padding: 8 }}>No other delegates available.</div>
                  : passengerOptions.map(d => (
                    <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px', borderRadius: 6, cursor: 'pointer', background: assignPassengers.includes(d.id) ? '#1e3a5f' : 'transparent' }}>
                      <input type="checkbox" checked={assignPassengers.includes(d.id)} onChange={() => togglePassenger(d.id)} />
                      <span style={{ fontSize: 14, color: '#f1f5f9' }}>{d.first_name} {d.last_name}</span>
                    </label>
                  ))
                }
              </div>
            </div>

            {assignError && (
              <div style={{ color: '#f87171', fontSize: 13, marginBottom: 14, background: '#450a0a', padding: '8px 12px', borderRadius: 6 }}>{assignError}</div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-green" style={{ flex: 1, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={handleStartSession} disabled={assigning}>
                <Play size={14} /> {assigning ? 'Starting...' : 'Start Session'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowAssign(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
