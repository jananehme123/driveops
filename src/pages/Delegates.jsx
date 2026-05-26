import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Users } from 'lucide-react'

const empty = { event_id: '', first_name: '', last_name: '', email: '', phone: '', status: 'pending' }

export default function Delegates() {
  const [delegates, setDelegates] = useState([])
  const [events, setEvents]       = useState([])
  const [filterEvent, setFilterEvent] = useState('')
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState(empty)
  const [editing, setEditing]     = useState(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function load() {
    setLoading(true)
    let query = supabase.from('delegates').select('*, event:events(name)').order('created_at', { ascending: false })
    if (filterEvent) query = query.eq('event_id', filterEvent)
    const [{ data: dels }, { data: evs }] = await Promise.all([
      query,
      supabase.from('events').select('id, name').order('name'),
    ])
    setDelegates(dels || []); setEvents(evs || []); setLoading(false)
  }

  useEffect(() => { load() }, [filterEvent])

  function openAdd() { setForm({ ...empty, event_id: filterEvent }); setEditing(null); setError(''); setShowModal(true) }
  function openEdit(d) {
    setForm({ event_id: d.event_id, first_name: d.first_name, last_name: d.last_name, email: d.email || '', phone: d.phone || '', status: d.status })
    setEditing(d.id); setError(''); setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setError('')
    const { error } = editing
      ? await supabase.from('delegates').update(form).eq('id', editing)
      : await supabase.from('delegates').insert(form)
    if (error) { setError(error.message); setSaving(false); return }
    setSaving(false); setShowModal(false); load()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this delegate?')) return
    await supabase.from('delegates').delete().eq('id', id); load()
  }

  async function signIndemnity(id) {
    await supabase.from('delegates').update({ indemnity_signed: true, indemnity_signed_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  async function setStatus(id, status) {
    await supabase.from('delegates').update({ status }).eq('id', id); load()
  }

  const filtered = delegates.filter(d => {
    const q = search.toLowerCase()
    return d.first_name.toLowerCase().includes(q) || d.last_name.toLowerCase().includes(q) || (d.email || '').toLowerCase().includes(q)
  })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Users size={24} color="#64748b" /> Delegates
        </h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Delegate</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <select className="input" style={{ maxWidth: 240 }} value={filterEvent} onChange={e => setFilterEvent(e.target.value)}>
          <option value="">All Events</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
        <input className="input" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 300 }} />
      </div>

      <div className="card">
        {loading ? <div style={{ color: '#475569', padding: 20, textAlign: 'center' }}>Loading...</div>
        : filtered.length === 0 ? <div style={{ color: '#475569', padding: 20, textAlign: 'center' }}>No delegates found.</div>
        : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Event</th><th>Email</th><th>Status</th><th>Indemnity</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id}>
                    <td style={{ color: '#f1f5f9', fontWeight: 500 }}>{d.first_name} {d.last_name}</td>
                    <td>{d.event?.name || '—'}</td>
                    <td>{d.email || '—'}</td>
                    <td>
                      <select value={d.status} onChange={e => setStatus(d.id, e.target.value)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                        <option value="pending">Pending</option>
                        <option value="authorised">Authorised</option>
                        <option value="unauthorised">Unauthorised</option>
                      </select>
                    </td>
                    <td>
                      {d.indemnity_signed
                        ? <span className="badge badge-green">Signed</span>
                        : <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => signIndemnity(d.id)}>Sign Now</button>
                      }
                    </td>
                    <td>
                      <button className="btn btn-ghost" style={{ marginRight: 8, padding: '4px 10px' }} onClick={() => openEdit(d)}>Edit</button>
                      <button className="btn btn-red" style={{ padding: '4px 10px' }} onClick={() => handleDelete(d.id)}>Delete</button>
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
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#f1f5f9' }}>{editing ? 'Edit Delegate' : 'Add Delegate'}</h3>
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
                  <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>First Name *</label>
                  <input className="input" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Last Name *</label>
                  <input className="input" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} required />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Email</label>
                <input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Phone</label>
                <input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Status</label>
                <select className="input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="pending">Pending</option>
                  <option value="authorised">Authorised</option>
                  <option value="unauthorised">Unauthorised</option>
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
