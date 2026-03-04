import { useState, useEffect, useCallback } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import useSocket from '../hooks/useSocket'
import StatusBadge from '../components/StatusBadge'

const DATE_RANGES = [
    { label: 'Today', key: 'today' },
    { label: 'Last 7 Days', key: '7d' },
    { label: 'Last 30 Days', key: '30d' },
    { label: 'Custom', key: 'custom' },
]

function getDateRange(key) {
    const today = new Date()
    const fmt = d => d.toISOString().split('T')[0]
    switch (key) {
        case 'today': return { date_from: fmt(today), date_to: fmt(today) }
        case '7d': {
            const from = new Date(today); from.setDate(from.getDate() - 6)
            return { date_from: fmt(from), date_to: fmt(today) }
        }
        case '30d': {
            const from = new Date(today); from.setDate(from.getDate() - 29)
            return { date_from: fmt(from), date_to: fmt(today) }
        }
        default: return { date_from: fmt(today), date_to: fmt(today) }
    }
}

function formatHour(h) {
    if (h === 0) return '12 AM'
    if (h === 12) return '12 PM'
    return h < 12 ? `${h} AM` : `${h - 12} PM`
}

function formatDate(str) {
    const d = new Date(str + 'T00:00:00')
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

const Skeleton = ({ className = '' }) => (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
)

export default function AnalyticsDashboard() {
    const [rangeKey, setRangeKey] = useState('today')
    const [customFrom, setCustomFrom] = useState('')
    const [customTo, setCustomTo] = useState('')
    const [summary, setSummary] = useState(null)
    const [revenueData, setRevenueData] = useState([])
    const [hourData, setHourData] = useState([])
    const [topItems, setTopItems] = useState([])
    const [liveOrders, setLiveOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAllItems, setShowAllItems] = useState(false)
    const { socket, isConnected } = useSocket()
    const { effectiveRestaurantId } = useAuth()
    const { isDark } = useTheme()

    // Theme-aware chart colors
    const chartGrid = isDark ? 'rgba(255,255,255,0.08)' : '#F0EBE3'
    const chartAxis = isDark ? '#7A9E8E' : '#A89E94'
    const tooltipBorder = isDark ? 'rgba(255,255,255,0.12)' : '#E8E3DC'
    const tooltipBg = isDark ? '#243830' : '#FFFFFF'
    const barDefault = isDark ? 'rgba(245,158,11,0.35)' : '#FDE68A'
    const barBusiest = isDark ? '#F59E0B' : '#D97706'

    const dateRange = rangeKey === 'custom'
        ? { date_from: customFrom, date_to: customTo }
        : getDateRange(rangeKey)

    const fetchAnalytics = useCallback(async () => {
        if (!dateRange.date_from || !dateRange.date_to) return
        setLoading(true)
        try {
            const params = { ...dateRange, restaurant_id: effectiveRestaurantId }
            const [sumRes, revRes, hourRes, itemRes] = await Promise.all([
                api.get('/api/analytics/summary', { params }),
                api.get('/api/analytics/revenue-by-day', { params }),
                api.get('/api/analytics/orders-by-hour', { params }),
                api.get('/api/analytics/popular-items', { params: { ...params, limit: 10 } }),
            ])
            setSummary(sumRes.data)
            setRevenueData(revRes.data.data || [])
            setHourData(hourRes.data.data || [])
            setTopItems(itemRes.data.items || [])
        } catch (err) {
            console.error('Failed to fetch analytics:', err)
        } finally {
            setLoading(false)
        }
    }, [dateRange.date_from, dateRange.date_to, effectiveRestaurantId])

    useEffect(() => { fetchAnalytics() }, [fetchAnalytics])

    const fetchLiveOrders = useCallback(async () => {
        try {
            const today = new Date().toISOString().split('T')[0]
            const res = await api.get('/api/orders', {
                params: { restaurant_id: effectiveRestaurantId, date: today },
            })
            setLiveOrders(res.data.filter(o => o.status !== 'DELIVERED'))
        } catch (err) { console.error(err) }
    }, [effectiveRestaurantId])

    useEffect(() => { fetchLiveOrders() }, [fetchLiveOrders])

    useEffect(() => {
        if (!socket) return
        const handleNew = (data) => {
            setLiveOrders(prev => {
                if (prev.find(o => o.id === data.order_id)) return prev
                return [{
                    id: data.order_id, status: data.status,
                    table_number: data.table_number, total_amount: data.total_amount,
                    customer_note: data.customer_note, created_at: data.created_at,
                    items: data.items?.map(i => ({ item_name: i.name, quantity: i.quantity })) || [],
                }, ...prev]
            })
        }
        const handleUpdated = (data) => {
            setLiveOrders(prev => {
                if (data.status === 'DELIVERED') return prev.filter(o => o.id !== data.order_id)
                return prev.map(o => o.id === data.order_id ? { ...o, status: data.status } : o)
            })
        }
        socket.on('order:new', handleNew)
        socket.on('order:updated', handleUpdated)
        return () => { socket.off('order:new', handleNew); socket.off('order:updated', handleUpdated) }
    }, [socket])

    const maxHour = hourData.reduce((max, d) => d.order_count > max.order_count ? d : max, { order_count: 0 })

    return (
        <div>
            {/* Page Header */}
            <div className="page-header-bar">
                <h1 className="page-title">Analytics</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {DATE_RANGES.map(r => (
                        <button key={r.key} onClick={() => setRangeKey(r.key)}
                            className={rangeKey === r.key ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}>
                            {r.label}
                        </button>
                    ))}
                    {rangeKey === 'custom' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                                className="form-input" style={{ width: 'auto', padding: '5px 10px', fontSize: 13 }} />
                            <span style={{ color: 'var(--text-muted)' }}>→</span>
                            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                                className="form-input" style={{ width: 'auto', padding: '5px 10px', fontSize: 13 }} />
                        </div>
                    )}
                </div>
            </div>

            <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                    {loading ? (
                        [1, 2, 3, 4].map(i => (
                            <div key={i} className="stat-card">
                                <Skeleton className="h-3 w-20 mb-3" />
                                <Skeleton className="h-8 w-28 mb-2" />
                                <Skeleton className="h-3 w-32" />
                            </div>
                        ))
                    ) : (
                        <>
                            <div className="stat-card">
                                <p className="stat-label">Total Revenue</p>
                                <p className="stat-value">{summary ? `₹${summary.total_revenue.toLocaleString('en-IN')}` : '—'}</p>
                                <p className="stat-sub">{summary ? `from ${summary.completed_orders} completed orders` : '—'}</p>
                            </div>
                            <div className="stat-card">
                                <p className="stat-label">Total Orders</p>
                                <p className="stat-value">{summary ? summary.total_orders : '—'}</p>
                                <p className="stat-sub">{summary ? `${summary.completed_orders} completed` : '—'}</p>
                            </div>
                            <div className="stat-card">
                                <p className="stat-label">Avg Order Value</p>
                                <p className="stat-value">{summary ? `₹${summary.average_order_value.toLocaleString('en-IN')}` : '—'}</p>
                                <p className="stat-sub">per completed order</p>
                            </div>
                            <div className="stat-card">
                                <p className="stat-label">Avg Prep Time</p>
                                <p className="stat-value">{summary ? `${summary.average_prep_time_minutes}m` : '—'}</p>
                                <p className="stat-sub">from order to ready</p>
                            </div>
                        </>
                    )}
                </div>

                {/* Revenue Chart */}
                <div className="card" style={{ padding: 20 }}>
                    <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
                        Revenue Over Time
                    </h2>
                    {revenueData.length === 0 || revenueData.every(d => d.revenue === 0) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                            <p>No orders in this period yet</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={revenueData}>
                                <defs>
                                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12, fontFamily: 'DM Sans', fill: chartAxis }} stroke={chartAxis} />
                                <YAxis tick={{ fontSize: 12, fontFamily: 'DM Sans', fill: chartAxis }} stroke={chartAxis} tickFormatter={v => `₹${v}`} />
                                <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']}
                                    labelFormatter={formatDate}
                                    contentStyle={{ borderRadius: 8, border: `1px solid ${tooltipBorder}`, fontSize: 13, fontFamily: 'DM Sans', background: tooltipBg, color: isDark ? '#F0EDE8' : undefined }} />
                                <Area type="monotone" dataKey="revenue" stroke="#F59E0B" strokeWidth={2} fill="url(#revenueGrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Peak Hours + Top Items */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                    {/* Peak Hours */}
                    <div className="card" style={{ padding: 20 }}>
                        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
                            Busiest Hours
                        </h2>
                        {hourData.every(d => d.order_count === 0) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                                <p style={{ fontSize: 14 }}>No data yet</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={hourData.filter(d => d.order_count > 0 || (d.hour >= 8 && d.hour <= 23))}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                                    <XAxis dataKey="hour" tickFormatter={formatHour} tick={{ fontSize: 11, fontFamily: 'DM Sans', fill: chartAxis }} stroke={chartAxis} />
                                    <YAxis tick={{ fontSize: 12, fontFamily: 'DM Sans', fill: chartAxis }} stroke={chartAxis} allowDecimals={false} />
                                    <Tooltip labelFormatter={h => formatHour(h)}
                                        formatter={(v) => [`${v} orders`]}
                                        contentStyle={{ borderRadius: 8, border: `1px solid ${tooltipBorder}`, fontSize: 13, fontFamily: 'DM Sans', background: tooltipBg, color: isDark ? '#F0EDE8' : undefined }} />
                                    <Bar dataKey="order_count" radius={[4, 4, 0, 0]}
                                        shape={(props) => {
                                            const { x, y, width, height, payload } = props
                                            const isBusiest = payload.hour === maxHour.hour && maxHour.order_count > 0
                                            return <rect x={x} y={y} width={width} height={height} rx={4} ry={4}
                                                fill={isBusiest ? barBusiest : barDefault} />
                                        }} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* Top Items */}
                    <div className="card" style={{ padding: 20 }}>
                        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
                            Most Popular Items
                        </h2>
                        {topItems.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                                <p style={{ fontSize: 14 }}>No items sold yet</p>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {topItems.slice(0, showAllItems ? 10 : 5).map((item, i) => (
                                        <div key={item.menu_item_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px', borderRadius: 6 }}>
                                            <span style={{
                                                width: 24, height: 24, borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 12, fontWeight: 700,
                                                background: i < 3 ? 'var(--saffron-light)' : 'var(--stone-100)',
                                                color: i < 3 ? 'var(--saffron-dark)' : 'var(--text-muted)',
                                            }}>
                                                {i + 1}
                                            </span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {item.name}
                                                </p>
                                                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.category}</p>
                                            </div>
                                            <span className="badge badge-active" style={{ fontSize: 11 }}>{item.total_ordered} sold</span>
                                            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, minWidth: 60, textAlign: 'right' }}>
                                                ₹{item.total_revenue.toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                {topItems.length > 5 && (
                                    <button onClick={() => setShowAllItems(!showAllItems)}
                                        className="btn btn-ghost btn-sm" style={{ marginTop: 8, color: 'var(--saffron-dark)' }}>
                                        {showAllItems ? 'Show less' : `View all ${topItems.length}`}
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Live Orders */}
                <div className="table-wrapper">
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
                                Live Orders
                            </h2>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Real-time view of active orders</p>
                        </div>
                        <span className={`live-pill${isConnected ? '' : ' offline'}`}>
                            {isConnected ? 'Live' : 'Disconnected'}
                        </span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
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
                                {liveOrders.length === 0 && (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                                        No active orders right now
                                    </td></tr>
                                )}
                                {liveOrders.map(order => (
                                    <tr key={order.id}>
                                        <td>{order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{order.table_number || '-'}</td>
                                        <td>{order.items?.length || 0} items</td>
                                        <td><StatusBadge status={order.status} /></td>
                                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>₹{Number(order.total_amount || 0).toFixed(0)}</td>
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
