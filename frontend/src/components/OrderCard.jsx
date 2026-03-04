import { useState, useEffect } from 'react'
import StatusBadge from './StatusBadge'
import { useTheme } from '../context/ThemeContext'

function timeAgo(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return `${diff}s ago`
    const mins = Math.floor(diff / 60)
    return `${mins} min ago`
}

export default function OrderCard({ order, actionLabel, onAction, highlight }) {
    const [elapsed, setElapsed] = useState(timeAgo(order.created_at))
    const isOld = (Date.now() - new Date(order.created_at).getTime()) > 15 * 60 * 1000
    const { isDark } = useTheme()

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(timeAgo(order.created_at))
        }, 10000)
        return () => clearInterval(interval)
    }, [order.created_at])

    return (
        <div className="order-card" style={highlight ? {
            outline: '2px solid var(--saffron)',
            background: 'var(--saffron-light)',
        } : {}}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {order.table_number}
                </span>
                <StatusBadge status={order.status} />
            </div>

            <p style={{ fontSize: 12, marginBottom: 8, color: isOld ? (isDark ? '#FCA5A5' : '#DC2626') : 'var(--text-muted)', fontWeight: isOld ? 600 : 400 }}>
                {elapsed}
            </p>

            <ul style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8, listStyle: 'none', padding: 0 }}>
                {order.items?.map((item, i) => (
                    <li key={i} style={{ padding: '2px 0' }}>{item.quantity}× {item.name || item.item_name}</li>
                ))}
            </ul>

            {order.customer_note && (
                <p style={{
                    fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)',
                    marginBottom: 12, borderLeft: '2px solid var(--border)', paddingLeft: 8,
                }}>
                    {order.customer_note}
                </p>
            )}

            {order.total_amount && (
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
                    ₹{order.total_amount}
                </p>
            )}

            {actionLabel && (
                <button onClick={() => onAction(order)} className="btn btn-primary" style={{ width: '100%' }}>
                    {actionLabel}
                </button>
            )}
        </div>
    )
}
