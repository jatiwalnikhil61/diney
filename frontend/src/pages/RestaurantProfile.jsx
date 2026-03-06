import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function RestaurantProfile() {
    const { effectiveRestaurantId, email } = useAuth()
    const [restaurant, setRestaurant] = useState(null)
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)

    const [form, setForm] = useState({ name: '', email: '', phone: '' })
    const [original, setOriginal] = useState({ name: '', email: '', phone: '' })
    const fileRef = useRef(null)

    // ─── Fetch ────────────────────────────────────────
    const fetchProfile = async () => {
        try {
            setLoading(true)
            const res = await api.get('/api/restaurants/profile/me', {
                params: { restaurant_id: effectiveRestaurantId },
            })
            setRestaurant(res.data)
            const vals = { name: res.data.name, email: res.data.email, phone: res.data.phone || '' }
            setForm(vals)
            setOriginal(vals)
        } catch { toast.error('Failed to load profile') }
        finally { setLoading(false) }
    }

    useEffect(() => { if (effectiveRestaurantId) fetchProfile() }, [effectiveRestaurantId])

    // ─── Save ─────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await api.patch('/api/restaurants/profile/me', form, {
                params: { restaurant_id: effectiveRestaurantId },
            })
            setRestaurant(res.data)
            const vals = { name: res.data.name, email: res.data.email, phone: res.data.phone || '' }
            setForm(vals)
            setOriginal(vals)
            setEditing(false)
            toast.success('Profile updated!')
        } catch (err) { toast.error(err.response?.data?.detail || 'Save failed') }
        finally { setSaving(false) }
    }

    const handleCancel = () => {
        setForm(original)
        setEditing(false)
    }

    // ─── Logo ─────────────────────────────────────────
    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        try {
            const fd = new FormData()
            fd.append('logo', file)
            const res = await api.post(
                `/api/restaurants/profile/me/logo?restaurant_id=${effectiveRestaurantId}`,
                fd
            )
            setRestaurant(prev => ({ ...prev, logo_url: res.data.logo_url }))
            toast.success('Logo updated!')
        } catch (err) { toast.error(err.response?.data?.detail || 'Upload failed') }
        finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
    }

    const handleRemoveLogo = async () => {
        try {
            await api.delete('/api/restaurants/profile/me/logo', {
                params: { restaurant_id: effectiveRestaurantId },
            })
            setRestaurant(prev => ({ ...prev, logo_url: null }))
            toast.success('Logo removed')
        } catch { toast.error('Failed to remove logo') }
    }

    // ─── Helpers ──────────────────────────────────────
    const initials = (name) => {
        if (!name) return '?'
        return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return ''
        const d = new Date(dateStr)
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }

    if (loading) {
        return (
            <div>
                <div className="page-header-bar"><h1 className="page-title">Profile</h1></div>
                <div className="page-content">
                    <div className="animate-pulse" style={{ maxWidth: 560 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--stone-200)' }} />
                            <div style={{ height: 14, background: 'var(--stone-200)', borderRadius: 4, width: 80 }} />
                        </div>
                        <div className="card" style={{ padding: 24 }}>
                            {[1, 2, 3].map(i => <div key={i} style={{ height: 40, background: 'var(--stone-200)', borderRadius: 6, marginBottom: 12 }} />)}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div>
            <div className="page-header-bar">
                <h1 className="page-title">Profile</h1>
            </div>

            <div className="page-content">
                <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-6)' }}>
                    {/* Avatar */}
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
                        {uploading ? (
                            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--stone-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-3)' }}>
                                <svg style={{ width: 28, height: 28, color: 'var(--text-muted)' }} className="animate-spin" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
                                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75" />
                                </svg>
                            </div>
                        ) : restaurant?.logo_url ? (
                            <img src={restaurant.logo_url} alt="Logo"
                                style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--cream-border)', boxShadow: 'var(--shadow-md)', display: 'block', margin: '0 auto var(--space-3)' }} />
                        ) : (
                            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--cardamom)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-3)', boxShadow: 'var(--shadow-md)' }}>
                                <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 700, color: '#FFFFFF' }}>{initials(restaurant?.name)}</span>
                            </div>
                        )}
                        <button onClick={() => fileRef.current?.click()} disabled={uploading}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--saffron)', fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', textAlign: 'center', margin: '0 auto' }}>
                            Change Logo
                        </button>
                        {restaurant?.logo_url && (
                            <button onClick={handleRemoveLogo}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 'var(--text-sm)', marginTop: 4, display: 'block', margin: '4px auto 0' }}>
                                Remove
                            </button>
                        )}
                        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoUpload} style={{ display: 'none' }} />
                    </div>

                    {/* Restaurant Details card */}
                    <div className="card" style={{ width: '100%', padding: 'var(--space-6)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
                            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--card-text)' }}>Restaurant Details</h2>
                            {!editing && (
                                <button onClick={() => setEditing(true)} className="btn btn-secondary btn-sm">Edit</button>
                            )}
                        </div>

                        {[
                            { label: 'Restaurant Name', key: 'name', type: 'text', placeholder: '' },
                            { label: 'Contact Email', key: 'email', type: 'email', placeholder: '' },
                            { label: 'Contact Phone', key: 'phone', type: 'text', placeholder: '+91XXXXXXXXXX' },
                        ].map(({ label, key, type, placeholder }, i, arr) => (
                            <div key={key} style={{
                                paddingBottom: 'var(--space-4)',
                                marginBottom: 'var(--space-4)',
                                borderBottom: i < arr.length - 1 ? '1px solid var(--cream-border)' : 'none',
                            }}>
                                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>{label}</label>
                                {editing ? (
                                    <input type={type} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                                        placeholder={placeholder} className="form-input" />
                                ) : (
                                    <p style={{ fontSize: 'var(--text-base)', color: 'var(--card-text)', fontWeight: 500, margin: 0 }}>{form[key] || '—'}</p>
                                )}
                            </div>
                        ))}

                        {editing && (
                            <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-5)' }}>
                                <button onClick={handleCancel} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                                <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Account Info card */}
                    <div className="card" style={{ width: '100%', padding: 'var(--space-6)' }}>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--card-text)', marginBottom: 'var(--space-4)' }}>Account Info</h2>
                        {[
                            { label: 'Owner Email', value: email, mono: false },
                            { label: 'Member Since', value: formatDate(restaurant?.created_at), mono: false },
                            { label: 'Restaurant ID', value: restaurant?.id, mono: true },
                        ].map(({ label, value, mono }, i, arr) => (
                            <div key={label} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: 'var(--space-3) 0',
                                borderBottom: i < arr.length - 1 ? '1px solid var(--cream-border)' : 'none',
                                fontSize: 'var(--text-sm)',
                            }}>
                                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                                <span style={{
                                    color: 'var(--card-text)', fontWeight: 500,
                                    fontFamily: mono ? 'monospace' : undefined,
                                    fontSize: mono ? 'var(--text-xs)' : 'var(--text-sm)',
                                    wordBreak: mono ? 'break-all' : undefined,
                                    textAlign: mono ? 'right' : undefined,
                                    maxWidth: mono ? '55%' : undefined,
                                }}>{value}</span>
                            </div>
                        ))}
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 'var(--space-4)', textAlign: 'center' }}>
                            To change your login email or password, contact Diney support.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
