import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Building2 } from 'lucide-react'

const empty = { name: '', contact_email: '', contact_phone: '' }

export default function Clients() {
  const [clients, setClients]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState(empty)
  const [editing, setEditing]     = useState(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    setClients(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() { setForm(empty); setEditing(null); setError(''); setShowModal(true) }
  function openEdit(c) { setForm({ name: c.name, contact_email: c.contact_email || '', contact_phone: c.contact_phone || '' }); setEditing(c.id); setError(''); setShowModal(true) }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setError('')
    const { error } = editing
      ? await supabase.from('clients').update(form).eq('id', editing)
      : await supabase.from('clients').insert(form)
    if (error) { setError(error.message); setSaving(false); return }
    setSaving(false); setShowModal(false); load()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this client? This will also delete all their events.')) return
    await supabase.from('clients').delete().eq('id', id); load()
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Building2 size={24} color="#64748b" /> Clients
        </h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Client</button>
      </div>

      <div className="card">
        {loading ? <div style={{ color: '#475569', padding: 20, textAlign: 'center' }}>Loading...</div>
        : clients.length === 0 ? <div style={{ color: '#475569', padding: 20, textAlign: 'center' }}>No clients yet. Add your first client!</div>
        : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Client Name</th><th>Email</th><th>Phone</th><th>Added</th><th>Actions</th></tr></thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id}>
                    <td style={{ color: '#f1f5f9', fontWeight: 500 }}>{c.name}</td>
                    <td>{c.contact_email || '—'}</td>
                    <td>{c.contact_phone || '—'}</td>
                    <td>{new Date(c.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn btn-ghost" style={{ marginRight: 8, padding: '4px 10px' }} onClick={() => openEdit(c)}>Edit</button>
                      <button className="btn btn-red" style={{ padding: '4px 10px' }} onClick={() => handleDelete(c.id)}>Delete</button>
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
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#f1f5f9' }}>{editing ? 'Edit Client' : 'Add Client'}</h3>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Client Name *</label>
                <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="e.g. Acme Corp" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Contact Email</label>
                <input className="input" type="email" value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})} placeholder="contact@company.com" />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Contact Phone</label>
                <input className="input" value={form.contact_phone} onChange={e => setForm({...form, contact_phone: e.target.value})} placeholder="+44 7700 000000" />
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
