import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Calendar } from 'lucide-react'

const empty = { client_id: '', name: '', event_date: '', location: '', status: 'upcoming' }

export default function Events() {
  const [events, setEvents]       = useState([])
  const [clients, setClients]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState(empty)
  const [editing, setEditing]     = useState(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function load() {
    setLoading(true)
    const [{ data: evs }, { data: cls }] = await Promise.all([
      supabase.from('events').select('*, client:clients(name)').order('event_date', { ascending: false }),
      supabase.from('clients').select('id, name').order('name'),
    ])
    setEvents(evs || []); setClients(cls || []); setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() { setForm(empty); setEditing(null); setError(''); setShowModal(true) }
  function openEdit(ev) {
    setForm({ client_id: ev.client_id, name: ev.name, event_date: ev.event_date || '', location: ev.location || '', status: ev.status })
    setEditing(ev.id); setError(''); setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setError('')
    const payload = { ...form, client_id: form.client_id || null }
    const { error } = editing
      ? await supabase.from('events').update(payload).eq('id', editing)
      : await supabase.from('events').insert(payload)
    if (error) { setError(error.message); setSaving(false); return }
    setSaving(false); setShowModal(false); load()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this event? All delegates and vehicles will also be deleted.')) return
    await supabase.from('events').delete().eq('id', id); load()
  }

  const statusColors = { upcoming: 'badge-blue', active: 'badge-green', completed: 'badge-gray' }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Calendar size={24} color="#64748b" /> Events
        </h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Event</button>
      </div>

      <div className="card">
        {loading ? <div style={{ color: '#475569', padding: 20, textAlign: 'center' }}>Loading...</div>
        : events.length === 0 ? <div style={{ color: '#475569', padding: 20, textAlign: 'center' }}>No events yet.</div>
        : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Event Name</th><th>Client</th><th>Date</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {events.map(ev => (
                  <tr key={ev.id}>
                    <td style={{ color: '#f1f5f9', fontWeight: 500 }}>{ev.name}</td>
                    <td>{ev.client?.name || '—'}</td>
                    <td>{ev.event_date ? new Date(ev.event_date).toLocaleDateString() : '—'}</td>
                    <td>{ev.location || '—'}</td>
                    <td><span className={`badge ${statusColors[ev.status]}`}>{ev.status}</span></td>
                    <td>
                      <button className="btn btn-ghost" style={{ marginRight: 8, padding: '4px 10px' }} onClick={() => openEdit(ev)}>Edit</button>
                      <button className="btn btn-red" style={{ padding: '4px 10px' }} onClick={() => handleDelete(ev.id)}>Delete</button>
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
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#f1f5f9' }}>{editing ? 'Edit Event' : 'Add Event'}</h3>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Event Name *</label>
                <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="e.g. Summer Drive Day 2025" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Client</label>
                <select className="input" value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})}>
                  <option value="">— No client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Date</label>
                <input className="input" type="date" value={form.event_date} onChange={e => setForm({...form, event_date: e.target.value})} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Location</label>
                <input className="input" value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="e.g. Silverstone Circuit" />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Status</label>
                <select className="input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
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
