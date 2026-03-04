import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import StatusBadge from '../components/StatusBadge'

export default function SuperAdminOverview() {
    const [stats, setStats] = useState(null)
    const [activity, setActivity] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchData = useCallback(async () => {
        try {
            const [statsRes, activityRes] = await Promise.all([
                api.get('/api/superadmin/stats'),
                api.get('/api/superadmin/activity', { params: { limit: 20 } }),
            ])
            setStats(statsRes.data)
            setActivity(activityRes.data.activity || [])
        } catch (err) {
            console.error('Failed to fetch SA data:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    // Auto-refresh activity every 30 seconds
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await api.get('/api/superadmin/activity', { params: { limit: 20 } })
                setActivity(res.data.activity || [])
            } catch { }
        }, 30000)
        return () => clearInterval(interval)
    }, [])

    const Skeleton = ({ className }) => <div className={`animate-pulse bg-gray-200 rounded ${className}`} />

    return (
        <div>
            <div className="page-header-bar">
                <h1 className="page-title">Overview</h1>
                <span className="live-pill">Live</span>
            </div>
            <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Platform Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {loading ? [1, 2, 3, 4].map(i => (
                        <div key={i} className="stat-card">
                            <Skeleton className="h-3 w-20 mb-3" />
                            <Skeleton className="h-8 w-28 mb-2" />
                            <Skeleton className="h-3 w-32" />
                        </div>
                    )) : (
                        <>
                            <div className="stat-card">
                                <p className="stat-label">Total Restaurants</p>
                                <p className="stat-value">{stats?.active_restaurants || 0}</p>
                                <p className="stat-sub">{stats?.active_restaurants} active of {stats?.total_restaurants} total</p>
                            </div>
                            <div className="stat-card">
                                <p className="stat-label">Orders Today</p>
                                <p className="stat-value">{stats?.total_orders_today || 0}</p>
                                <p className="stat-sub">across all restaurants</p>
                            </div>
                            <div className="stat-card">
                                <p className="stat-label">Revenue Today</p>
                                <p className="stat-value">₹{(stats?.total_revenue_today || 0).toLocaleString('en-IN')}</p>
                                <p className="stat-sub">across all restaurants</p>
                            </div>
                            <div className="stat-card">
                                <p className="stat-label">New This Month</p>
                                <p className="stat-value">{stats?.new_restaurants_this_month || 0}</p>
                                <p className="stat-sub">restaurants onboarded</p>
                            </div>
                        </>
                    )}
                </div>

                {/* Activity Feed */}
                <div className="card" style={{ padding: 0 }}>
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--stone-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 14, color: 'var(--stone-800)' }}>
                                Recent Orders — All Restaurants
                            </p>
                            <p style={{ fontSize: 12, color: 'var(--stone-400)', marginTop: 2 }}>Auto-refreshes every 30 seconds</p>
                        </div>
                        <Link to="/superadmin/restaurants"
                            style={{ fontSize: 12, color: 'var(--saffron-dark)', fontWeight: 500, textDecoration: 'none' }}>
                            View all restaurants →
                        </Link>
                    </div>
                    <div className="table-wrapper">
                        <table className="ds-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Restaurant</th>
                                    <th>Table</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activity.length === 0 && (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--stone-400)', padding: '32px 16px' }}>No orders yet</td></tr>
                                )}
                                {activity.map(a => (
                                    <tr key={a.order_id}>
                                        <td style={{ color: 'var(--stone-500)', fontSize: 12 }}>
                                            {a.created_at ? new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </td>
                                        <td style={{ fontWeight: 500 }}>{a.restaurant_name}</td>
                                        <td>{a.table_number || '-'}</td>
                                        <td><StatusBadge status={a.status} /></td>
                                        <td style={{ textAlign: 'right', fontWeight: 500 }}>₹{Number(a.total_amount || 0).toFixed(0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
