import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'

const TABS = ['All', 'Active', 'Inactive']

export default function SuperAdminRestaurants() {
    const [restaurants, setRestaurants] = useState([])
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(1)
    const [page, setPage] = useState(1)
    const [tab, setTab] = useState('All')
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [confirmDialog, setConfirmDialog] = useState(null) // { id, name, is_active }
    const [toggleLoading, setToggleLoading] = useState({}) // { `${id}_kitchen`: true }

    const fetchRestaurants = useCallback(async () => {
        setLoading(true)
        try {
            const params = { page, page_size: 20 }
            if (tab === 'Active') params.is_active = true
            if (tab === 'Inactive') params.is_active = false
            if (search) params.search = search
            const res = await api.get('/api/superadmin/restaurants', { params })
            setRestaurants(res.data.restaurants || [])
            setTotal(res.data.total || 0)
            setTotalPages(res.data.total_pages || 1)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [page, tab, search])

    useEffect(() => { fetchRestaurants() }, [fetchRestaurants])
    useEffect(() => { setPage(1) }, [tab, search])

    const handleTogglePermission = async (id, name, field, value) => {
        const key = `${id}_${field}`
        setToggleLoading(prev => ({ ...prev, [key]: true }))
        try {
            const r = restaurants.find(r => r.id === id)
            await api.patch(`/api/superadmin/restaurants/${id}/permissions`, {
                can_access_kitchen: field === 'can_access_kitchen' ? value : r.owner_can_access_kitchen,
                can_access_waiter: field === 'can_access_waiter' ? value : r.owner_can_access_waiter,
            })
            setRestaurants(prev => prev.map(r => r.id === id ? {
                ...r,
                [field === 'can_access_kitchen' ? 'owner_can_access_kitchen' : 'owner_can_access_waiter']: value,
            } : r))
            const label = field === 'can_access_kitchen' ? 'Kitchen' : 'Waiter'
            toast.success(`${label} access ${value ? 'enabled' : 'disabled'} for ${name}`)
        } catch (err) {
            toast.error('Failed to update permission')
        } finally {
            setToggleLoading(prev => ({ ...prev, [key]: false }))
        }
    }

    const handleToggleActive = async () => {
        if (!confirmDialog) return
        const { id, is_active } = confirmDialog
        try {
            await api.patch(`/api/superadmin/restaurants/${id}`, { is_active: !is_active })
            toast.success(`Restaurant ${!is_active ? 'activated' : 'deactivated'}`)
            setConfirmDialog(null)
            fetchRestaurants()
        } catch (err) {
            toast.error('Failed to update status')
        }
    }

    const Toggle = ({ checked, loading: isLoading, onChange }) => (
        <button onClick={() => !isLoading && onChange(!checked)} disabled={isLoading}
            style={{
                position: 'relative', display: 'inline-flex', height: 20, width: 36,
                alignItems: 'center', borderRadius: 999, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                background: checked ? 'var(--saffron)' : 'var(--stone-300)', opacity: isLoading ? 0.5 : 1,
                transition: 'background 0.2s',
            }}>
            {isLoading ? (
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ width: 10, height: 10, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'block' }} />
                </span>
            ) : (
                <span style={{
                    display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: 'white',
                    transform: checked ? 'translateX(19px)' : 'translateX(3px)', transition: 'transform 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
            )}
        </button>
    )

    return (
        <div>
            <div className="page-header-bar">
                <h1 className="page-title">Restaurants</h1>
                <button onClick={() => setShowModal(true)} className="btn btn-primary">
                    + Onboard Restaurant
                </button>
            </div>
            <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Search + Tabs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <input type="text" placeholder="Search by restaurant name or owner email..."
                        value={search} onChange={e => setSearch(e.target.value)}
                        className="form-input" style={{ flex: 1, minWidth: 200 }} />
                    <div style={{ display: 'flex', gap: 4 }}>
                        {TABS.map(t => (
                            <button key={t} onClick={() => setTab(t)}
                                className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`}
                                style={{ padding: '6px 14px', fontSize: 13 }}>
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table */}
                <div className="card" style={{ padding: 0 }}>
                    <div className="table-wrapper">
                        <table className="ds-table">
                            <thead>
                                <tr>
                                    <th>Restaurant</th>
                                    <th>Owner</th>
                                    <th>Staff</th>
                                    <th>Orders</th>
                                    <th>Permissions</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? [1, 2, 3].map(i => (
                                    <tr key={i}>
                                        {[1, 2, 3, 4, 5, 6, 7].map(j => (
                                            <td key={j}><div className="animate-pulse bg-gray-200 rounded" style={{ height: 16, width: '100%' }} /></td>
                                        ))}
                                    </tr>
                                )) : restaurants.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--stone-400)' }}>
                                            No restaurants found
                                        </td>
                                    </tr>
                                ) : restaurants.map(r => (
                                    <tr key={r.id}>
                                        <td>
                                            <p style={{ fontWeight: 500, color: 'var(--stone-900)' }}>{r.name}</p>
                                            <p style={{ fontSize: 12, color: 'var(--stone-400)' }}>{r.email}</p>
                                        </td>
                                        <td>
                                            <p style={{ color: 'var(--stone-700)' }}>{r.owner_name || '-'}</p>
                                            <p style={{ fontSize: 12, color: 'var(--stone-400)' }}>{r.owner_email || ''}</p>
                                        </td>
                                        <td>{r.total_staff} staff</td>
                                        <td>{r.total_orders}</td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <Toggle
                                                        checked={r.owner_can_access_kitchen}
                                                        loading={toggleLoading[`${r.id}_can_access_kitchen`]}
                                                        onChange={v => handleTogglePermission(r.id, r.name, 'can_access_kitchen', v)} />
                                                    <span style={{ fontSize: 12, color: 'var(--stone-500)' }}>Kitchen</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <Toggle
                                                        checked={r.owner_can_access_waiter}
                                                        loading={toggleLoading[`${r.id}_can_access_waiter`]}
                                                        onChange={v => handleTogglePermission(r.id, r.name, 'can_access_waiter', v)} />
                                                    <span style={{ fontSize: 12, color: 'var(--stone-500)' }}>Waiter</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge ${r.is_active ? 'badge-active' : 'badge-inactive'}`}>
                                                {r.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Link to={`/superadmin/restaurants/${r.id}`}
                                                    style={{ fontSize: 12, color: 'var(--saffron-dark)', fontWeight: 500, textDecoration: 'none' }}>View</Link>
                                                <button onClick={() => setConfirmDialog({ id: r.id, name: r.name, is_active: r.is_active })}
                                                    style={{ fontSize: 12, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', color: r.is_active ? 'var(--red-600, #dc2626)' : 'var(--green-600, #16a34a)' }}>
                                                    {r.is_active ? 'Deactivate' : 'Activate'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {total > 0 && (
                        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--stone-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 12, color: 'var(--stone-500)' }}>Showing {restaurants.length} of {total}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                    className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }}>← Prev</button>
                                <span style={{ fontSize: 12, color: 'var(--stone-500)' }}>Page {page} of {totalPages}</span>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                    className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }}>Next →</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirm Dialog */}
            {confirmDialog && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
                    <div className="card" style={{ maxWidth: 360, width: '100%', boxShadow: 'var(--shadow-xl)' }}>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
                            {confirmDialog.is_active ? 'Deactivate' : 'Activate'} {confirmDialog.name}?
                        </h3>
                        <p style={{ fontSize: 14, color: 'var(--stone-600)', marginBottom: 20 }}>
                            {confirmDialog.is_active
                                ? 'Their QR codes will stop working immediately. This can be reversed at any time.'
                                : 'Their QR codes will start working again immediately.'}
                        </p>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => setConfirmDialog(null)} className="btn btn-secondary">Cancel</button>
                            <button onClick={handleToggleActive}
                                className={`btn ${confirmDialog.is_active ? 'btn-danger' : 'btn-primary'}`}>
                                {confirmDialog.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Onboard Modal */}
            {showModal && <OnboardModal onClose={() => setShowModal(false)} onSuccess={fetchRestaurants} />}
        </div>
    )
}


function OnboardModal({ onClose, onSuccess }) {
    const [form, setForm] = useState({
        restaurant_name: '', owner_name: '', owner_email: '', owner_phone: '', owner_password: '',
    })
    const [showPw, setShowPw] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const res = await api.post('/api/superadmin/restaurants', form)
            toast.success(`${res.data.name} onboarded successfully!`)
            onSuccess()
            onClose()
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to create restaurant')
        } finally {
            setLoading(false)
        }
    }

    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

    const fields = [
        { key: 'restaurant_name', label: 'Restaurant Name', type: 'text', required: true },
        { key: 'owner_name', label: 'Owner Full Name', type: 'text', required: true },
        { key: 'owner_email', label: 'Owner Email', type: 'email', required: true },
        { key: 'owner_phone', label: 'Owner Phone', type: 'text', required: true, placeholder: '+91XXXXXXXXXX' },
    ]

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
            <div className="card" style={{ maxWidth: 440, width: '100%', boxShadow: 'var(--shadow-xl)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>Onboard New Restaurant</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--stone-400)', lineHeight: 1 }}>×</button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {fields.map(f => (
                        <div key={f.key}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--stone-600)', marginBottom: 4 }}>{f.label} *</label>
                            <input type={f.type} required={f.required} value={form[f.key]}
                                onChange={e => set(f.key, e.target.value)}
                                placeholder={f.placeholder || ''}
                                className="form-input" />
                        </div>
                    ))}
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--stone-600)', marginBottom: 4 }}>Owner Password *</label>
                        <div style={{ position: 'relative' }}>
                            <input type={showPw ? 'text' : 'password'} required value={form.owner_password}
                                onChange={e => set('owner_password', e.target.value)}
                                className="form-input" style={{ paddingRight: 56 }} />
                            <button type="button" onClick={() => setShowPw(!showPw)}
                                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--stone-500)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                {showPw ? 'Hide' : 'Show'}
                            </button>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--stone-400)', marginTop: 4 }}>Share this with the owner</p>
                    </div>

                    {error && <p style={{ fontSize: 12, color: '#dc2626' }}>{error}</p>}

                    <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', marginTop: 4 }}>
                        {loading ? 'Creating...' : 'Create Restaurant'}
                    </button>
                </form>
            </div>
        </div>
    )
}
