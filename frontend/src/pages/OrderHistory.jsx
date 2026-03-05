import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import StatusBadge from '../components/StatusBadge'

const DATE_RANGES = [
    { label: 'Today', key: 'today' },
    { label: 'Last 7 Days', key: '7d' },
    { label: 'Last 30 Days', key: '30d' },
    { label: 'Custom', key: 'custom' },
]

const STATUSES = ['All', 'PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'PICKED_UP', 'DELIVERED']
const PAGE_SIZES = [20, 50, 100]

const ORDER_COLUMNS = [
    { key: 'id', label: 'Order ID' },
    { key: 'date', label: 'Date' },
    { key: 'time', label: 'Time' },
    { key: 'table', label: 'Table' },
    { key: 'items_summary', label: 'Items (summary)' },
    { key: 'status', label: 'Status' },
    { key: 'amount', label: 'Amount (₹)' },
    { key: 'note', label: 'Customer Note' },
]

const ITEM_COLUMNS = [
    { key: 'id', label: 'Order ID' },
    { key: 'date', label: 'Date' },
    { key: 'time', label: 'Time' },
    { key: 'table', label: 'Table' },
    { key: 'item_name', label: 'Item Name' },
    { key: 'item_qty', label: 'Qty' },
    { key: 'item_unit_price', label: 'Unit Price (₹)' },
    { key: 'item_line_total', label: 'Line Total (₹)' },
    { key: 'status', label: 'Order Status' },
    { key: 'order_total', label: 'Order Total (₹)' },
    { key: 'note', label: 'Customer Note' },
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

function buildCSV(orders, columns, expandItems) {
    const cols = expandItems ? ITEM_COLUMNS.filter(c => columns.includes(c.key)) : ORDER_COLUMNS.filter(c => columns.includes(c.key))
    const headers = cols.map(c => c.label)

    const rows = []

    for (const o of orders) {
        const date = o.created_at ? new Date(o.created_at).toLocaleDateString() : ''
        const time = o.created_at ? new Date(o.created_at).toLocaleTimeString() : ''

        if (!expandItems) {
            const row = cols.map(c => {
                switch (c.key) {
                    case 'id': return o.id
                    case 'date': return date
                    case 'time': return time
                    case 'table': return o.table_number || ''
                    case 'items_summary': return (o.items || []).map(i => `${i.name} x${i.quantity}`).join('; ')
                    case 'status': return o.status
                    case 'amount': return o.total_amount ?? ''
                    case 'note': return o.customer_note || ''
                    default: return ''
                }
            })
            rows.push(row)
        } else {
            const items = o.items || []
            if (items.length === 0) {
                const row = cols.map(c => {
                    switch (c.key) {
                        case 'id': return o.id
                        case 'date': return date
                        case 'time': return time
                        case 'table': return o.table_number || ''
                        case 'status': return o.status
                        case 'order_total': return o.total_amount ?? ''
                        case 'note': return o.customer_note || ''
                        default: return ''
                    }
                })
                rows.push(row)
            } else {
                for (const item of items) {
                    const lineTotal = (Number(item.price_at_order || 0) * item.quantity).toFixed(2)
                    const row = cols.map(c => {
                        switch (c.key) {
                            case 'id': return o.id
                            case 'date': return date
                            case 'time': return time
                            case 'table': return o.table_number || ''
                            case 'item_name': return item.name
                            case 'item_qty': return item.quantity
                            case 'item_unit_price': return item.price_at_order ?? ''
                            case 'item_line_total': return lineTotal
                            case 'status': return o.status
                            case 'order_total': return o.total_amount ?? ''
                            case 'note': return o.customer_note || ''
                            default: return ''
                        }
                    })
                    rows.push(row)
                }
            }
        }
    }

    return [headers, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
}

// ─── Export Modal ──────────────────────────────────────────────────────────────
function ExportModal({ onClose, dateRange, statusFilter, tableFilter, effectiveRestaurantId }) {
    const [expandItems, setExpandItems] = useState(false)
    const [selectedCols, setSelectedCols] = useState(
        ORDER_COLUMNS.map(c => c.key)
    )
    const [exporting, setExporting] = useState(false)
    const [previewCount, setPreviewCount] = useState(null)
    const [loadingCount, setLoadingCount] = useState(true)

    const availableCols = expandItems ? ITEM_COLUMNS : ORDER_COLUMNS

    // Sync column selection when switching modes
    const handleExpandToggle = (val) => {
        setExpandItems(val)
        setSelectedCols(val ? ITEM_COLUMNS.map(c => c.key) : ORDER_COLUMNS.map(c => c.key))
    }

    const toggleCol = (key) => {
        setSelectedCols(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        )
    }

    // Fetch preview row count
    useEffect(() => {
        const fetch = async () => {
            setLoadingCount(true)
            try {
                const params = { ...dateRange, page: 1, page_size: 1, restaurant_id: effectiveRestaurantId }
                if (statusFilter !== 'All') params.status = statusFilter
                if (tableFilter) params.table_id = tableFilter
                const res = await api.get('/api/analytics/orders', { params })
                setPreviewCount(res.data.total || 0)
            } catch { setPreviewCount(null) }
            finally { setLoadingCount(false) }
        }
        fetch()
    }, [])

    const handleExport = async () => {
        if (selectedCols.length === 0) {
            toast.error('Select at least one column')
            return
        }
        setExporting(true)
        try {
            const params = { ...dateRange, page: 1, page_size: 5000, restaurant_id: effectiveRestaurantId }
            if (statusFilter !== 'All') params.status = statusFilter
            if (tableFilter) params.table_id = tableFilter

            const res = await api.get('/api/analytics/orders', { params })
            const orders = res.data.orders || []

            if (orders.length === 0) {
                toast('No orders to export', { icon: 'ℹ️' })
                return
            }

            const csv = buildCSV(orders, selectedCols, expandItems)
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `diney-orders-${dateRange.date_from}-${dateRange.date_to}.csv`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            toast.success(`Exported ${orders.length} order${orders.length > 1 ? 's' : ''}`)
            onClose()
        } catch (err) {
            console.error('Export failed:', err)
            toast.error('Export failed. Please try again.')
        } finally {
            setExporting(false)
        }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
            <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', maxHeight: '90vh', borderRadius: 14, boxShadow: 'var(--shadow-xl)' }}>
                {/* Header */}
                <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Export Report</h2>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            {loadingCount ? 'Counting...' : previewCount !== null ? `${previewCount} order${previewCount !== 1 ? 's' : ''} match your filters` : ''}
                        </p>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost" style={{ fontSize: 20, lineHeight: 1, padding: '2px 8px' }}>×</button>
                </div>

                <div style={{ overflowY: 'auto', flex: 1, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Row format */}
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Row Format</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {[{ val: false, title: 'One row per order', sub: 'Items joined in one cell' },
                              { val: true, title: 'One row per item', sub: 'Expanded for accounting' }].map(opt => (
                                <button key={String(opt.val)}
                                    onClick={() => handleExpandToggle(opt.val)}
                                    style={{
                                        padding: 12, borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                                        border: `2px solid ${expandItems === opt.val ? 'var(--saffron)' : 'var(--border)'}`,
                                        background: expandItems === opt.val ? 'var(--saffron-light)' : 'var(--white)',
                                    }}>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{opt.title}</p>
                                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{opt.sub}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Column picker */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Columns</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => setSelectedCols(availableCols.map(c => c.key))}
                                    className="btn btn-ghost btn-sm" style={{ color: 'var(--saffron-dark)', padding: '2px 6px' }}>All</button>
                                <button onClick={() => setSelectedCols([])}
                                    className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }}>None</button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {availableCols.map(col => (
                                <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 6, cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedCols.includes(col.key)}
                                        onChange={() => toggleCol(col.key)}
                                        style={{ width: 15, height: 15, accentColor: 'var(--saffron)', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{col.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border-light)', display: 'flex', gap: 8 }}>
                    <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                    <button onClick={handleExport} disabled={exporting || selectedCols.length === 0}
                        className="btn btn-primary" style={{ flex: 1 }}>
                        {exporting ? 'Exporting...' : 'Export CSV'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function OrderHistory() {
    const [rangeKey, setRangeKey] = useState(() => sessionStorage.getItem('oh_rangeKey') || '7d')
    const [customFrom, setCustomFrom] = useState(() => sessionStorage.getItem('oh_customFrom') || '')
    const [customTo, setCustomTo] = useState(() => sessionStorage.getItem('oh_customTo') || '')
    const [statusFilter, setStatusFilter] = useState('All')
    const [tableFilter, setTableFilter] = useState('')
    const [tables, setTables] = useState([])
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)
    const [data, setData] = useState({ orders: [], total: 0, total_pages: 1 })
    const [expandedId, setExpandedId] = useState(null)
    const [loading, setLoading] = useState(true)
    const [exportModalOpen, setExportModalOpen] = useState(false)
    const { effectiveRestaurantId } = useAuth()

    useEffect(() => {
        sessionStorage.setItem('oh_rangeKey', rangeKey)
        sessionStorage.setItem('oh_customFrom', customFrom)
        sessionStorage.setItem('oh_customTo', customTo)
    }, [rangeKey, customFrom, customTo])

    const dateRange = rangeKey === 'custom'
        ? { date_from: customFrom, date_to: customTo }
        : getDateRange(rangeKey)

    useEffect(() => {
        api.get('/api/tables', { params: { restaurant_id: effectiveRestaurantId } })
            .then(res => setTables(res.data))
            .catch(() => { })
    }, [effectiveRestaurantId])

    const fetchOrders = useCallback(async () => {
        if (!dateRange.date_from || !dateRange.date_to) return
        setLoading(true)
        try {
            const params = {
                ...dateRange,
                page,
                page_size: pageSize,
                restaurant_id: effectiveRestaurantId,
            }
            if (statusFilter !== 'All') params.status = statusFilter
            if (tableFilter) params.table_id = tableFilter

            const res = await api.get('/api/analytics/orders', { params })
            setData(res.data)
        } catch (err) {
            console.error('Failed to fetch orders:', err)
        } finally {
            setLoading(false)
        }
    }, [dateRange.date_from, dateRange.date_to, statusFilter, tableFilter, page, pageSize, effectiveRestaurantId])

    useEffect(() => { fetchOrders() }, [fetchOrders])
    useEffect(() => { setPage(1) }, [rangeKey, customFrom, customTo, statusFilter, tableFilter, pageSize])

    const startIdx = (page - 1) * pageSize + 1
    const endIdx = Math.min(page * pageSize, data.total)

    return (
        <div>
            <div className="page-header-bar">
                <h1 className="page-title">Order History</h1>
                <button onClick={() => setExportModalOpen(true)} className="btn btn-primary btn-sm">
                    Export Report
                </button>
            </div>

            <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Filter Bar */}
                <div className="card" style={{ padding: 14, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                        {DATE_RANGES.map(r => (
                            <button key={r.key} onClick={() => setRangeKey(r.key)}
                                className={rangeKey === r.key ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}>
                                {r.label}
                            </button>
                        ))}
                    </div>
                    {rangeKey === 'custom' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                                className="form-input" style={{ width: 'auto', padding: '5px 10px', fontSize: 13 }} />
                            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>→</span>
                            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                                className="form-input" style={{ width: 'auto', padding: '5px 10px', fontSize: 13 }} />
                        </div>
                    )}
                    <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 2px' }} />
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-input" style={{ width: 'auto', padding: '5px 10px', fontSize: 13 }}>
                        {STATUSES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
                    </select>
                    <select value={tableFilter} onChange={e => setTableFilter(e.target.value)} className="form-input" style={{ width: 'auto', padding: '5px 10px', fontSize: 13 }}>
                        <option value="">All Tables</option>
                        {tables.map(t => <option key={t.id} value={t.id}>{t.table_number}</option>)}
                    </select>
                    <div style={{ flex: 1 }} />
                    <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="form-input" style={{ width: 'auto', padding: '5px 10px', fontSize: 13 }}>
                        {PAGE_SIZES.map(s => <option key={s} value={s}>{s} per page</option>)}
                    </select>
                </div>

                {/* Orders Table */}
                <div className="table-wrapper">
                    <div style={{ overflowX: 'auto' }}>
                        <table className="ds-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 32 }}></th>
                                    <th>Time</th>
                                    <th>Table</th>
                                    <th>Items</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Amount</th>
                                    <th>Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    [1, 2, 3, 4, 5].map(i => (
                                        <tr key={i}>
                                            {[1, 2, 3, 4, 5, 6, 7].map(j => (
                                                <td key={j}><div className="animate-pulse bg-gray-200 rounded" style={{ height: 14, width: '100%' }} /></td>
                                            ))}
                                        </tr>
                                    ))
                                ) : data.orders.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                                            No orders found for the selected filters
                                        </td>
                                    </tr>
                                ) : (
                                    data.orders.map(order => (
                                        <>
                                            <tr key={order.id}
                                                onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                                                style={{ cursor: 'pointer' }}>
                                                <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                                                    {expandedId === order.id ? '▼' : '▶'}
                                                </td>
                                                <td>
                                                    {order.created_at ? (
                                                        <>
                                                            <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                                                                {new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                            </span>
                                                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                                {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </>
                                                    ) : '-'}
                                                </td>
                                                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{order.table_number || '-'}</td>
                                                <td>{order.item_count} items</td>
                                                <td><StatusBadge status={order.status} /></td>
                                                <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>₹{Number(order.total_amount || 0).toFixed(0)}</td>
                                                <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.customer_note || ''}</td>
                                            </tr>
                                            {expandedId === order.id && (
                                                <tr key={`${order.id}-detail`} style={{ background: 'var(--stone-50)' }}>
                                                    <td colSpan={7} style={{ padding: '12px 32px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                            {order.items.map((item, idx) => (
                                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14 }}>
                                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                                        <span style={{ color: 'var(--text-muted)' }}>×{item.quantity}</span>
                                                                        <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', gap: 16, color: 'var(--text-muted)' }}>
                                                                        <span>₹{item.price_at_order}</span>
                                                                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>₹{(item.price_at_order * item.quantity).toFixed(0)}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {order.customer_note && (
                                                                <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                                                                    {order.customer_note}
                                                                </div>
                                                            )}
                                                            <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                                                <span>Total</span>
                                                                <span>₹{Number(order.total_amount || 0).toFixed(0)}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {data.total > 0 && (
                        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                Showing {startIdx}–{endIdx} of {data.total} orders
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                    className="btn btn-secondary btn-sm">← Prev</button>
                                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {page} of {data.total_pages}</span>
                                <button onClick={() => setPage(p => Math.min(data.total_pages, p + 1))} disabled={page >= data.total_pages}
                                    className="btn btn-secondary btn-sm">Next →</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {exportModalOpen && (
                <ExportModal
                    onClose={() => setExportModalOpen(false)}
                    dateRange={dateRange}
                    statusFilter={statusFilter}
                    tableFilter={tableFilter}
                    effectiveRestaurantId={effectiveRestaurantId}
                />
            )}
        </div>
    )
}
