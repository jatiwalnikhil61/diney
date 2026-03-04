import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useTheme } from '../context/ThemeContext'
import StatusBadge from '../components/StatusBadge'

export default function SuperAdminRestaurantDetail() {
    const { id } = useParams()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [toggleLoading, setToggleLoading] = useState({})
    const [statusLoading, setStatusLoading] = useState(false)
    const { isDark } = useTheme()

    const fetchDetail = useCallback(async () => {
        setLoading(true)
        try {
            const res = await api.get(`/api/superadmin/restaurants/${id}`)
            setData(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [id])

    useEffect(() => { fetchDetail() }, [fetchDetail])

    const handleTogglePermission = async (field, value) => {
        setToggleLoading(prev => ({ ...prev, [field]: true }))
        try {
            await api.patch(`/api/superadmin/restaurants/${id}/permissions`, {
                can_access_kitchen: field === 'can_access_kitchen' ? value : data.owner.can_access_kitchen,
                can_access_waiter: field === 'can_access_waiter' ? value : data.owner.can_access_waiter,
            })
            setData(prev => ({
                ...prev,
                owner: {
                    ...prev.owner,
                    [field]: value,
                },
            }))
            const label = field === 'can_access_kitchen' ? 'Kitchen' : 'Waiter'
            toast.success(`${label} access ${value ? 'enabled' : 'disabled'}`)
        } catch {
            toast.error('Failed to update permission')
        } finally {
            setToggleLoading(prev => ({ ...prev, [field]: false }))
        }
    }

    const handleToggleActive = async () => {
        if (!data) return
        setStatusLoading(true)
        try {
            await api.patch(`/api/superadmin/restaurants/${id}`, { is_active: !data.is_active })
            setData(prev => ({ ...prev, is_active: !prev.is_active }))
            toast.success(`Restaurant ${!data.is_active ? 'activated' : 'deactivated'}`)
        } catch {
            toast.error('Failed to update status')
        } finally {
            setStatusLoading(false)
        }
    }

    const Toggle = ({ checked, isLoading, onChange, label, helper }) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--stone-700)' }}>{label}</p>
                <p style={{ fontSize: 12, color: 'var(--stone-400)', marginTop: 2 }}>{helper}</p>
            </div>
            <button onClick={() => !isLoading && onChange(!checked)} disabled={isLoading}
                style={{
                    position: 'relative', display: 'inline-flex', height: 24, width: 44,
                    alignItems: 'center', borderRadius: 999, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                    background: checked ? 'var(--saffron)' : 'var(--stone-300)', opacity: isLoading ? 0.5 : 1,
                    transition: 'background 0.2s', flexShrink: 0,
                }}>
                {isLoading ? (
                    <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ width: 12, height: 12, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'block' }} />
                    </span>
                ) : (
                    <span style={{
                        display: 'inline-block', width: 16, height: 16, borderRadius: '50%', background: 'white',
                        transform: checked ? 'translateX(24px)' : 'translateX(4px)', transition: 'transform 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                )}
            </button>
        </div>
    )

    if (loading) return (
        <div>
            <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[1, 2, 3].map(i => <div key={i} className="card" style={{ height: 160, animation: 'pulse 1.5s infinite' }} />)}
            </div>
        </div>
    )

    if (!data) return (
        <div>
            <div className="page-content" style={{ textAlign: 'center', color: 'var(--stone-400)' }}>Restaurant not found</div>
        </div>
    )

    return (
        <div>
            <div className="page-header-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Link to="/superadmin/restaurants"
                        style={{ fontSize: 13, color: 'var(--stone-500)', textDecoration: 'none' }}>← All Restaurants</Link>
                    <span style={{ color: 'var(--stone-300)' }}>/</span>
                    <h1 className="page-title" style={{ margin: 0 }}>{data.name}</h1>
                </div>
                <button onClick={handleToggleActive} disabled={statusLoading}
                    className={`btn ${data.is_active ? 'btn-danger' : 'btn-primary'}`}
                    style={{ opacity: statusLoading ? 0.6 : 1 }}>
                    {statusLoading ? '...' : data.is_active ? 'Deactivate' : 'Activate'}
                </button>
            </div>
            <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Section 1: Restaurant Info */}
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                        <div>
                            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>{data.name}</h2>
                            <span className={`badge ${data.is_active ? 'badge-active' : 'badge-inactive'}`} style={{ marginTop: 6, display: 'inline-block' }}>
                                {data.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
                        {[
                            { label: 'Email', value: data.email },
                            { label: 'Phone', value: data.phone },
                            { label: 'Created', value: data.created_at ? new Date(data.created_at).toLocaleDateString() : '-' },
                            { label: 'Total Orders', value: data.stats.total_orders, bold: true },
                            { label: 'Total Revenue', value: `₹${Number(data.stats.total_revenue).toLocaleString('en-IN')}`, bold: true },
                        ].map(item => (
                            <div key={item.label}>
                                <p style={{ fontSize: 12, color: 'var(--stone-400)', marginBottom: 2 }}>{item.label}</p>
                                <p style={{ fontSize: 14, color: 'var(--stone-700)', fontWeight: item.bold ? 600 : 400 }}>{item.value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Section 2: Owner & Permissions */}
                <div className="card">
                    <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--stone-700)', marginBottom: 12 }}>Owner & Permissions</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
                        {[
                            { label: 'Name', value: data.owner?.name },
                            { label: 'Email', value: data.owner?.email },
                            { label: 'Phone', value: data.owner?.phone },
                        ].map(item => (
                            <div key={item.label}>
                                <p style={{ fontSize: 12, color: 'var(--stone-400)', marginBottom: 2 }}>{item.label}</p>
                                <p style={{ fontSize: 14, color: 'var(--stone-700)' }}>{item.value || '-'}</p>
                            </div>
                        ))}
                    </div>
                    <div style={{ borderTop: '1px solid var(--stone-100)', paddingTop: 12 }}>
                        {/* NOTE: Permission changes take effect on the owner's NEXT login
                            because permissions are embedded in the JWT at login time. */}
                        <Toggle
                            checked={data.owner?.can_access_kitchen}
                            isLoading={toggleLoading.can_access_kitchen}
                            onChange={v => handleTogglePermission('can_access_kitchen', v)}
                            label="Kitchen Dashboard Access"
                            helper="Owner can view and interact with the kitchen dashboard"
                        />
                        <Toggle
                            checked={data.owner?.can_access_waiter}
                            isLoading={toggleLoading.can_access_waiter}
                            onChange={v => handleTogglePermission('can_access_waiter', v)}
                            label="Waiter Dashboard Access"
                            helper="Owner can view and interact with the waiter dashboard"
                        />
                        <p style={{ fontSize: 12, color: '#d97706', marginTop: 8 }}>⚠ Permission changes take effect on the owner's next login</p>
                    </div>
                </div>

                {/* Section 3: Staff */}
                <div className="card" style={{ padding: 0 }}>
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--stone-100)' }}>
                        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--stone-700)' }}>Staff ({data.staff.length})</h2>
                    </div>
                    <div className="table-wrapper">
                        <table className="ds-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Role</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.staff.length === 0 ? (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--stone-400)' }}>No staff members</td></tr>
                                ) : data.staff.map(s => (
                                    <tr key={s.id}>
                                        <td style={{ fontWeight: 500 }}>{s.name}</td>
                                        <td>
                                            <span className={`badge ${s.role === 'OWNER' ? 'badge-owner' : s.role === 'CHEF' ? 'badge-chef' : 'badge-waiter'}`}
                                                style={{
                                                    background: isDark
                                                        ? (s.role === 'OWNER' ? 'rgba(124,58,237,0.15)' : s.role === 'CHEF' ? 'rgba(234,88,12,0.15)' : 'rgba(37,99,235,0.15)')
                                                        : (s.role === 'OWNER' ? '#f3e8ff' : s.role === 'CHEF' ? '#fff7ed' : '#eff6ff'),
                                                    color: isDark
                                                        ? (s.role === 'OWNER' ? '#C4B5FD' : s.role === 'CHEF' ? '#FDBA74' : '#93C5FD')
                                                        : (s.role === 'OWNER' ? '#7e22ce' : s.role === 'CHEF' ? '#c2410c' : '#1d4ed8'),
                                                }}>
                                                {s.role}
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--stone-500)' }}>{s.email}</td>
                                        <td style={{ color: 'var(--stone-500)' }}>{s.phone}</td>
                                        <td>
                                            <span className={`badge ${s.is_active ? 'badge-active' : 'badge-inactive'}`}>
                                                {s.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Section 4: Recent Orders */}
                <div className="card" style={{ padding: 0 }}>
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--stone-100)' }}>
                        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--stone-700)' }}>Recent Orders</h2>
                    </div>
                    <div className="table-wrapper">
                        <table className="ds-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Table</th>
                                    <th>Items</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data.recent_orders || []).length === 0 ? (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--stone-400)' }}>No orders yet</td></tr>
                                ) : data.recent_orders.map(o => (
                                    <tr key={o.id}>
                                        <td style={{ color: 'var(--stone-500)', fontSize: 12 }}>
                                            {o.created_at ? new Date(o.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </td>
                                        <td style={{ fontWeight: 500 }}>{o.table_number || '-'}</td>
                                        <td style={{ color: 'var(--stone-500)' }}>{o.item_count} items</td>
                                        <td><StatusBadge status={o.status} /></td>
                                        <td style={{ textAlign: 'right', fontWeight: 500 }}>₹{Number(o.total_amount || 0).toFixed(0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Section 5: Menu Stats */}
                <div className="card">
                    <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--stone-700)', marginBottom: 12 }}>
                        Menu — {data.menu.category_count} categories · {data.menu.item_count} items
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {data.menu.categories.map((cat, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                                <span style={{ fontSize: 14, color: 'var(--stone-700)' }}>{cat.name}</span>
                                <span style={{ fontSize: 12, color: 'var(--stone-400)' }}>{cat.item_count} items</span>
                            </div>
                        ))}
                        {data.menu.categories.length === 0 && (
                            <p style={{ fontSize: 14, color: 'var(--stone-400)' }}>No menu items</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
