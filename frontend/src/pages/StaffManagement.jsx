import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function StaffManagement() {
    const { effectiveRestaurantId } = useAuth()
    const [staff, setStaff] = useState([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState('CHEF')

    // Modals
    const [addOpen, setAddOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [resetOpen, setResetOpen] = useState(false)
    const [selectedStaff, setSelectedStaff] = useState(null)

    // Inline deactivate confirm
    const [confirmDeactivate, setConfirmDeactivate] = useState(null)

    // Forms
    const [addForm, setAddForm] = useState({ name: '', email: '', phone: '', role: 'CHEF', password: '' })
    const [editForm, setEditForm] = useState({ name: '', phone: '', role: '' })
    const [resetPw, setResetPw] = useState('')
    const [showAddPw, setShowAddPw] = useState(false)
    const [showResetPw, setShowResetPw] = useState(false)
    const [saving, setSaving] = useState(false)
    const [formError, setFormError] = useState('')

    // ─── Fetch ────────────────────────────────────────
    const fetchStaff = async () => {
        try {
            setLoading(true)
            const res = await api.get('/api/staff', {
                params: { restaurant_id: effectiveRestaurantId },
            })
            setStaff(res.data)
        } catch { toast.error('Failed to load staff') }
        finally { setLoading(false) }
    }

    useEffect(() => { if (effectiveRestaurantId) fetchStaff() }, [effectiveRestaurantId])

    const filtered = staff.filter(s => s.role === tab)
    const active = filtered.filter(s => s.is_active)
    const inactive = filtered.filter(s => !s.is_active)
    const sorted = [...active, ...inactive]

    // ─── Add Staff ────────────────────────────────────
    const openAdd = () => {
        setAddForm({ name: '', email: '', phone: '', role: tab, password: '' })
        setFormError('')
        setShowAddPw(false)
        setAddOpen(true)
    }

    const handleAdd = async () => {
        if (!addForm.name.trim() || !addForm.email.trim() || !addForm.phone.trim() || !addForm.password.trim()) {
            setFormError('All fields are required'); return
        }
        setSaving(true); setFormError('')
        try {
            await api.post('/api/staff', {
                ...addForm,
                restaurant_id: effectiveRestaurantId,
            })
            toast.success('Staff member added! Login details sent via SMS.')
            setAddOpen(false)
            fetchStaff()
        } catch (err) {
            setFormError(err.response?.data?.detail || 'Failed to add staff')
        } finally { setSaving(false) }
    }

    // ─── Edit Staff ───────────────────────────────────
    const openEdit = (s) => {
        setSelectedStaff(s)
        setEditForm({ name: s.name, phone: s.phone, role: s.role })
        setFormError('')
        setEditOpen(true)
    }

    const handleEdit = async () => {
        setSaving(true); setFormError('')
        try {
            await api.patch(`/api/staff/${selectedStaff.id}`, editForm)
            toast.success('Staff updated')
            setEditOpen(false)
            fetchStaff()
        } catch (err) {
            setFormError(err.response?.data?.detail || 'Update failed')
        } finally { setSaving(false) }
    }

    // ─── Reset Password ──────────────────────────────
    const openReset = (s) => {
        setSelectedStaff(s)
        setResetPw('')
        setShowResetPw(false)
        setFormError('')
        setResetOpen(true)
    }

    const handleReset = async () => {
        if (!resetPw.trim()) { setFormError('Password is required'); return }
        setSaving(true); setFormError('')
        try {
            await api.post(`/api/staff/${selectedStaff.id}/reset-password`, { new_password: resetPw })
            toast.success('Password reset. New password sent via SMS.')
            setResetOpen(false)
        } catch (err) {
            setFormError(err.response?.data?.detail || 'Reset failed')
        } finally { setSaving(false) }
    }

    // ─── Deactivate / Reactivate ─────────────────────
    const handleToggleActive = async (s) => {
        try {
            await api.patch(`/api/staff/${s.id}`, { is_active: !s.is_active })
            toast.success(s.is_active ? 'Staff deactivated' : 'Staff reactivated')
            setConfirmDeactivate(null)
            fetchStaff()
        } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
    }

    // ─── RENDER ───────────────────────────────────────
    return (
        <div>
            <div className="page-header-bar">
                <h1 className="page-title">Staff Management</h1>
                <button onClick={openAdd} className="btn btn-primary">+ Add Staff Member</button>
            </div>
            <div className="page-content" style={{ maxWidth: 900 }}>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--white)', borderRadius: 12, padding: 4, border: '1px solid var(--stone-200)', width: 'fit-content' }}>
                    <button onClick={() => setTab('CHEF')}
                        className={`btn ${tab === 'CHEF' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ padding: '8px 16px' }}>
                        Kitchen Staff
                    </button>
                    <button onClick={() => setTab('WAITER')}
                        className={`btn ${tab === 'WAITER' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ padding: '8px 16px' }}>
                        Waiters
                    </button>
                </div>

                {/* Table */}
                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[1, 2].map(i => <div key={i} style={{ height: 56, background: 'var(--white)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />)}
                    </div>
                ) : sorted.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--stone-400)', fontSize: 14 }}>
                        No {tab === 'CHEF' ? 'chefs' : 'waiters'} added yet. Add one →
                    </div>
                ) : (
                    <div className="card" style={{ padding: 0 }}>
                        <div className="table-wrapper">
                            <table className="ds-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Phone</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map(s => (
                                        <tr key={s.id} style={{ opacity: s.is_active ? 1 : 0.5 }}>
                                            <td style={{ fontWeight: 500 }}>{s.name}</td>
                                            <td style={{ color: 'var(--stone-500)' }}>{s.email}</td>
                                            <td style={{ color: 'var(--stone-500)' }}>{s.phone}</td>
                                            <td>
                                                <span className={`badge ${s.is_active ? 'badge-active' : 'badge-inactive'}`}>
                                                    {s.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {confirmDeactivate === s.id ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                                                        <span style={{ color: 'var(--stone-600)' }}>Deactivate {s.name}?</span>
                                                        <button onClick={() => handleToggleActive(s)}
                                                            style={{ color: '#dc2626', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Yes</button>
                                                        <button onClick={() => setConfirmDeactivate(null)}
                                                            style={{ color: 'var(--stone-400)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                                                    </span>
                                                ) : (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                        <button onClick={() => openEdit(s)}
                                                            style={{ padding: '4px 6px', color: 'var(--stone-400)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6 }}
                                                            title="Edit">✏️</button>
                                                        <button onClick={() => openReset(s)}
                                                            style={{ padding: '4px 6px', color: 'var(--stone-400)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6 }}
                                                            title="Reset Password">🔑</button>
                                                        {s.is_active ? (
                                                            <button onClick={() => setConfirmDeactivate(s.id)}
                                                                style={{ padding: '4px 6px', color: 'var(--stone-400)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6 }}
                                                                title="Deactivate">🚫</button>
                                                        ) : (
                                                            <button onClick={() => handleToggleActive(s)}
                                                                style={{ padding: '4px 6px', color: 'var(--stone-400)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6 }}
                                                                title="Reactivate">✅</button>
                                                        )}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Add Staff Modal ──────────────────────── */}
            {addOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setAddOpen(false)} />
                    <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 440, margin: '0 16px', boxShadow: 'var(--shadow-xl)' }}>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Add Staff Member</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {[
                                { label: 'Full Name *', key: 'name', type: 'text' },
                                { label: 'Email *', key: 'email', type: 'email' },
                                { label: 'Phone *', key: 'phone', type: 'text', placeholder: '+91XXXXXXXXXX' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--stone-600)', marginBottom: 4 }}>{f.label}</label>
                                    <input type={f.type} value={addForm[f.key]}
                                        onChange={e => setAddForm(p => ({ ...p, [f.key]: e.target.value }))}
                                        placeholder={f.placeholder || ''}
                                        className="form-input" />
                                </div>
                            ))}
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--stone-600)', marginBottom: 4 }}>Role *</label>
                                <select value={addForm.role} onChange={e => setAddForm(p => ({ ...p, role: e.target.value }))}
                                    className="form-input">
                                    <option value="CHEF">Chef</option>
                                    <option value="WAITER">Waiter</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--stone-600)', marginBottom: 4 }}>Password *</label>
                                <div style={{ position: 'relative' }}>
                                    <input type={showAddPw ? 'text' : 'password'} value={addForm.password}
                                        onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))}
                                        className="form-input" style={{ paddingRight: 56 }} />
                                    <button type="button" onClick={() => setShowAddPw(!showAddPw)}
                                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--stone-500)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                        {showAddPw ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                                <p style={{ fontSize: 12, color: 'var(--stone-400)', marginTop: 4 }}>Share this password with the staff member</p>
                            </div>
                        </div>
                        {formError && <p style={{ fontSize: 13, color: '#dc2626', marginTop: 12 }}>{formError}</p>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                            <button onClick={() => setAddOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                            <button onClick={handleAdd} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
                                {saving ? 'Adding...' : 'Add Staff Member'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Edit Staff Modal ─────────────────────── */}
            {editOpen && selectedStaff && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setEditOpen(false)} />
                    <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 440, margin: '0 16px', boxShadow: 'var(--shadow-xl)' }}>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Edit Staff Member</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--stone-600)', marginBottom: 4 }}>Full Name</label>
                                <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                                    className="form-input" />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--stone-600)', marginBottom: 4 }}>Email</label>
                                <input value={selectedStaff.email} disabled
                                    className="form-input" style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                                <p style={{ fontSize: 12, color: 'var(--stone-400)', marginTop: 4 }}>Email cannot be changed</p>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--stone-600)', marginBottom: 4 }}>Phone</label>
                                <input value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
                                    className="form-input" />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--stone-600)', marginBottom: 4 }}>Role</label>
                                <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                                    className="form-input">
                                    <option value="CHEF">Chef</option>
                                    <option value="WAITER">Waiter</option>
                                </select>
                            </div>
                        </div>
                        {formError && <p style={{ fontSize: 13, color: '#dc2626', marginTop: 12 }}>{formError}</p>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                            <button onClick={() => setEditOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                            <button onClick={handleEdit} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Reset Password Modal ─────────────────── */}
            {resetOpen && selectedStaff && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setResetOpen(false)} />
                    <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 380, margin: '0 16px', boxShadow: 'var(--shadow-xl)' }}>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Reset Password</h2>
                        <p style={{ fontSize: 14, color: 'var(--stone-500)', marginBottom: 16 }}>For {selectedStaff.name}</p>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--stone-600)', marginBottom: 4 }}>New Password *</label>
                            <div style={{ position: 'relative' }}>
                                <input type={showResetPw ? 'text' : 'password'} value={resetPw}
                                    onChange={e => setResetPw(e.target.value)}
                                    className="form-input" style={{ paddingRight: 56 }} />
                                <button type="button" onClick={() => setShowResetPw(!showResetPw)}
                                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--stone-500)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                    {showResetPw ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </div>
                        {formError && <p style={{ fontSize: 13, color: '#dc2626', marginTop: 12 }}>{formError}</p>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                            <button onClick={() => setResetOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                            <button onClick={handleReset} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
                                {saving ? 'Resetting...' : 'Reset Password'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
