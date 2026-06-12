import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Car, RefreshCw, Timer, Play, RotateCcw, Search, Check, X } from 'lucide-react'

const STORAGE_KEY = 'driveops_selected_event'

export default function Operations() {
  const [events, setEvents]               = useState([])
  const [selectedEvent, setSelectedEvent] = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [availableCars, setAvailableCars] = useState([])
  const [activeSessions, setActiveSessions] = useState([])
  const [readyDelegates, setReadyDelegates] = useState([])
  const [loading, setLoading]             = useState(false)
  const [now, setNow]                     = useState(Date.now())
  const [confirmReturnId, setConfirmReturnId] = useState(null)

  // Assign modal
  const [showAssign, setShowAssign]       = useState(false)
  const [assignCar, setAssignCar]         = useState(null)
  const [assignDriver, setAssignDriver]   = useState('')      // delegate id
  const [driverSearch, setDriverSearch]   = useState('')      // typed text
  const [showDriverList, setShowDriverList] = useState(false)
  const [assignPassengers, setAssignPassengers] = useState([])
  const [assigning, setAssigning]         = useState(false)
  const [assignError, setAssignError]     = useState('')
  const driverInputRef                    = useRef(null)

  // ── Load events once ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('events').select('id, name').order('name').then(({ data }) => setEvents(data || []))
  }, [])

  // ── Persist selected event ───────────────────────────────────────────────────
  useEffect(() => {
    if (selectedEvent) localStorage.setItem(STORAGE_KEY, selectedEvent)
  }, [selectedEvent])

  // ── Load operations data ─────────────────────────────────────────────────────
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

  useEffect(() => { loadOperations() }, [selectedEvent])

  // ── Auto-refresh every 20 seconds ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedEvent) return
    const interval = setInterval(loadOperations, 20000)
    return () => clearInterval(interval)
  }, [selectedEvent])

  // ── Live ticking clock ───────────────────────────────────────────────────────
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [])

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function timeSince(date) {
    const diff = Math.floor((now - new Date(date)) / 1000)
    if (diff < 60) return `${diff}s`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`
  }

  function togglePassenger(id) {
    setAssignPassengers(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  // ── Driver search ────────────────────────────────────────────────────────────
  const filteredDrivers = driverSearch.length > 0
    ? readyDelegates.filter(d =>
        `${d.first_name} ${d.last_name}`.toLowerCase().includes(driverSearch.toLowerCase())
      )
    : readyDelegates

  function selectDriver(d) {
    setAssignDriver(d.id)
    setDriverSearch(`${d.first_name} ${d.last_name}`)
    setShowDriverList(false)
  }

  // ── Open assign modal ────────────────────────────────────────────────────────
  function openAssign(car) {
    setAssignCar(car)
    setAssignDriver('')
    setDriverSearch('')
    setAssignPassengers([])
    setAssignError('')
    setShowAssign(true)
    setTimeout(() => driverInputRef.current?.focus(), 50)
  }

  // ── Start session ────────────────────────────────────────────────────────────
  async function handleStartSession() {
    if (!assignDriver) { setAssignError('Please select a driver.'); return }
    setAssigning(true); setAssignError('')

    const { data: existing } = await supabase.from('car_sessions')
      .select('id').eq('driver_id', assignDriver).eq('status', 'active')
    if (existing && existing.length > 0) {
      setAssignError('This delegate is already in an active session.')
      setAssigning(false); return
    }

    const { data: session, error } = await supabase.from('car_sessions')
      .insert({ event_id: selectedEvent, vehicle_id: assignCar.id, driver_id: assignDriver })
      .select().single()

    if (error) { setAssignError(error.message); setAssigning(false); return }

    if (assignPassengers.length > 0) {
      await supabase.from('session_passengers').insert(
        assignPassengers.map(pid => ({ session_id: session.id, delegate_id: pid }))
      )
    }

    await supabase.from('vehicles').update({ status: 'in_use' }).eq('id', assignCar.id)
    await supabase.from('audit_logs').insert({
      event_id: selectedEvent, action: 'SESSION_STARTED',
      details: { session_id: session.id, vehicle_id: assignCar.id, driver_id: assignDriver }
    })

    setAssigning(false); setShowAssign(false); loadOperations()
  }

  // ── Return vehicle ───────────────────────────────────────────────────────────
  async function returnVehicle(session) {
    await supabase.from('car_sessions')
      .update({ status: 'completed', ended_at: new Date().toISOString() }).eq('id', session.id)
    await supabase.from('vehicles').update({ status: 'available' }).eq('id', session.vehicle_id)
    await supabase.from('audit_logs').insert({
      event_id: selectedEvent, action: 'SESSION_ENDED',
      details: { session_id: session.id, vehicle_id: session.vehicle_id }
    })
    setConfirmReturnId(null)
    loadOperations()
  }

  const passengerOptions = readyDelegates.filter(d => d.id !== assignDriver)

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Car size={24} color="#64748b" /> On-Site Operations
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {selectedEvent && (
            <span style={{ fontSize: 12, color: '#475569' }}>
              Auto-refreshes every 20s
            </span>
          )}
          <button className="btn btn-ghost" onClick={loadOperations} disabled={loading || !selectedEvent}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Event selector */}
      <div style={{ marginBottom: 24 }}>
        <select className="input" style={{ maxWidth: 320, fontSize: 15 }}
          value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}>
          <option value="">— Select an Event —</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
      </div>

      {!selectedEvent ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: '#475569' }}>
          Select an event above to start operations.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Available Cars */}
          <div className="card">
            <h2 style={{ fontSize: 13, fontWeight: 600, color: '#4ade80', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
              Available ({availableCars.length})
            </h2>
            {loading ? <div style={{ color: '#475569' }}>Loading...</div>
            : availableCars.length === 0
              ? <div style={{ color: '#475569', fontSize: 13 }}>No available cars.</div>
              : availableCars.map(car => (
                <div key={car.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #1e293b' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 15 }}>{car.make} {car.model}</div>
                    <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>{car.registration} · {car.color}</div>
                  </div>
                  <button className="btn btn-green"
                    style={{ padding: '8px 18px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                    onClick={() => openAssign(car)}>
                    <Play size={13} /> Assign
                  </button>
                </div>
              ))
            }
          </div>

          {/* Active Sessions */}
          <div className="card">
            <h2 style={{ fontSize: 13, fontWeight: 600, color: '#f87171', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171' }} />
              Active ({activeSessions.length})
            </h2>
            {loading ? <div style={{ color: '#475569' }}>Loading...</div>
            : activeSessions.length === 0
              ? <div style={{ color: '#475569', fontSize: 13 }}>No active sessions.</div>
              : activeSessions.map(s => (
                <div key={s.id} style={{ padding: '12px 0', borderBottom: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 15 }}>
                        {s.vehicle?.make} {s.vehicle?.model}
                        <span style={{ fontFamily: 'monospace', fontWeight: 400, fontSize: 12, color: '#64748b', marginLeft: 8 }}>
                          {s.vehicle?.registration}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
                        {s.driver?.first_name} {s.driver?.last_name}
                      </div>
                      <div style={{ fontSize: 12, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                        <Timer size={11} /> {timeSince(s.started_at)}
                      </div>
                    </div>

                    {/* Inline return confirmation */}
                    {confirmReturnId === s.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>Return?</span>
                        <button className="btn btn-red" style={{ padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => returnVehicle(s)}>
                          <Check size={13} /> Yes
                        </button>
                        <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 13 }}
                          onClick={() => setConfirmReturnId(null)}>
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button className="btn btn-ghost"
                        style={{ padding: '8px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #334155' }}
                        onClick={() => setConfirmReturnId(s.id)}>
                        <RotateCcw size={12} /> Return
                      </button>
                    )}
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Quick Assign Modal */}
      {showAssign && assignCar && (
        <div className="modal-overlay" onClick={() => setShowAssign(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#f1f5f9' }}>Quick Assign</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
              {assignCar.make} {assignCar.model} — {assignCar.registration}
            </p>

            {/* Searchable driver selector */}
            <div style={{ marginBottom: 16, position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
                Driver *
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
                <input
                  ref={driverInputRef}
                  className="input"
                  style={{ paddingLeft: 36 }}
                  placeholder="Type to search delegate..."
                  value={driverSearch}
                  onChange={e => { setDriverSearch(e.target.value); setAssignDriver(''); setShowDriverList(true) }}
                  onFocus={() => setShowDriverList(true)}
                />
              </div>
              {showDriverList && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, zIndex: 50, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                  {filteredDrivers.length === 0
                    ? <div style={{ padding: '10px 14px', color: '#475569', fontSize: 13 }}>No matching delegates found.</div>
                    : filteredDrivers.map(d => (
                      <div key={d.id}
                        onClick={() => selectDriver(d)}
                        style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 14, color: '#f1f5f9', borderBottom: '1px solid #334155', background: assignDriver === d.id ? '#1d4ed8' : 'transparent' }}
                        onMouseEnter={e => e.currentTarget.style.background = assignDriver === d.id ? '#1d4ed8' : '#0f172a'}
                        onMouseLeave={e => e.currentTarget.style.background = assignDriver === d.id ? '#1d4ed8' : 'transparent'}
                      >
                        {d.first_name} {d.last_name}
                      </div>
                    ))
                  }
                </div>
              )}
              {readyDelegates.length === 0 && (
                <p style={{ fontSize: 12, color: '#f87171', marginTop: 6 }}>No authorised delegates with signed indemnity available.</p>
              )}
            </div>

            {/* Passengers */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
                Passengers (optional)
              </label>
              <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #334155', borderRadius: 8, padding: 8 }}>
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
              <div style={{ color: '#f87171', fontSize: 13, marginBottom: 14, background: '#450a0a', padding: '8px 12px', borderRadius: 6 }}>
                {assignError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-green"
                style={{ flex: 1, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 700 }}
                onClick={handleStartSession} disabled={assigning || !assignDriver}>
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
