import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Truck } from 'lucide-react'

const empty = { event_id: '', make: '', model: '', registration: '', color: '', status: 'available' }

export default function Vehicles() {
  const [vehicles, setVehicles]   = useState([])
  const [events, setEvents]       = useState([])
  const [filterEvent, setFilterEvent] = useState('')
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState(empty)
  const [editing, setEditing]     = useState(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function load() {
    setLoading(true)
    let query = supabase.from('vehicles').select('*, event:events(name)').order('created_at', { ascending: false })
    if (filterEvent) query = query.eq('event_id', filterEvent)
    const [{ data: vehs }, { data: evs }] = await Promise.all([
      query,
      supabase.from('events').select('id, name').order('name'),
    ])
    setVehicles(vehs || []); setEvents(evs || []); setLoading(false)
  }

  useEffect(() => { load() }, [filterEvent])

  function openAdd() { setForm({ ...empty, event_id: filterEvent }); setEditing(null); setError(''); setShowModal(true) }
  function openEdit(v) {
    setForm({ event_id: v.event_id, make: v.make, model: v.model, registration: v.registration, color: v.color || '', status: v.status })
    setEditing(v.id); setError(''); setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setError('')
    const { error } = editing
      ? await supabase.from('vehicles').update(form).eq('id', editing)
      : await supabase.from('vehicles').insert(form)
    if (error) { setError(error.message); setSaving(false); return }
    setSaving(false); setShowModal(false); load()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this vehicle?')) return
    await supabase.from('vehicles').delete().eq('id', id); load()
  }

  const statusColors = { available: 'badge-green', in_use: 'badge-red', maintenance: 'badge-yellow' }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Truck size={24} color="#64748b" /> Vehicle Inventory
        </h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Vehicle</button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <select className="input" style={{ maxWidth: 240 }} value={filterEvent} onChange={e => setFilterEvent(e.target.value)}>
          <option value="">All Events</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {['available', 'in_use', 'maintenance'].map(s => (
          <div key={s} className={`badge ${statusColors[s]}`} style={{ padding: '6px 14px', fontSize: 13 }}>
            {s.replace('_', ' ')}: {vehicles.filter(v => v.status === s).length}
          </div>
        ))}
      </div>

      <div className="card">
        {loading ? <div style={{ color: '#475569', padding: 20, textAlign: 'center' }}>Loading...</div>
        : vehicles.length === 0 ? <div style={{ color: '#475569', padding: 20, textAlign: 'center' }}>No vehicles yet.</div>
        : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Make & Model</th><th>Registration</th><th>Color</th><th>Event</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {vehicles.map(v => (
                  <tr key={v.id}>
                    <td style={{ color: '#f1f5f9', fontWeight: 500 }}>{v.make} {v.model}</td>
                    <td style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>{v.registration}</td>
                    <td>{v.color || '—'}</td>
                    <td>{v.event?.name || '—'}</td>
                    <td><span className={`badge ${statusColors[v.status]}`}>{v.status.replace('_', ' ')}</span></td>
                    <td>
                      <button className="btn btn-ghost" style={{ marginRight: 8, padding: '4px 10px' }} onClick={() => openEdit(v)}>Edit</button>
                      <button className="btn btn-red" style={{ padding: '4px 10px' }} onClick={() => handleDelete(v.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#f1f5f9' }}>{editing ? 'Edit Vehicle' : 'Add Vehicle'}</h3>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Event *</label>
                <select className="input" value={form.event_id} onChange={e => setForm({...form, event_id: e.target.value})} required>
                  <option value="">— Select event —</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Make *</label>
                  <input className="input" value={form.make} onChange={e => setForm({...form, make: e.target.value})} required placeholder="e.g. BMW" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Model *</label>
                  <input className="input" value={form.model} onChange={e => setForm({...form, model: e.target.value})} required placeholder="e.g. M3" />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Registration *</label>
                <input className="input" value={form.registration} onChange={e => setForm({...form, registration: e.target.value.toUpperCase()})} required placeholder="e.g. AB12 CDE" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Color</label>
                <input className="input" value={form.color} onChange={e => setForm({...form, color: e.target.value})} placeholder="e.g. Midnight Blue" />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Status</label>
                <select className="input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="available">Available</option>
                  <option value="in_use">In Use</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 14 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
