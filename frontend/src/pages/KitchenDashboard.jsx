import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import useSocket from '../hooks/useSocket'
import OrderCard from '../components/OrderCard'

// Tiny base64 ding sound
const DING_SOUND = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczGjqIr9TJdUwvQG2Yvb6CUjQ4YJGztIxdRTtfkK+0i19GPGCQr7SLX0Y8YJCvtItfRjxgkK+0i19GO1+Pr7OMYEU+YJa3wpVmQD5gmbfCl2dEQGGbucifakg/YJm5xZdmQD5gmbnFl2Y/PV+YuMOUZEA+YZq5xJVlQD9imrrElWVAP2KausKTY0BAY5u7wpNjQEBjm7u/kGBBQmWdvL+QYEFCZZS1uIxeQ0NlnLzAkWFBQmWdvMCRYUFCZZ28v5BgQUJlnby/kGBBQmWcvL6PX0FDZZ28v5BgQkNmnry+'
const playDing = () => {
    try { new Audio(DING_SOUND).play() } catch { /* ignore */ }
}


export default function KitchenDashboard() {
    const [orders, setOrders] = useState([])
    const [highlightId, setHighlightId] = useState(null)
    const [confirmAction, setConfirmAction] = useState(null) // { type: 'cancel'|'remove', order }
    const [actionLoading, setActionLoading] = useState(false)
    const { socket, isConnected } = useSocket()
    const { effectiveRestaurantId, role } = useAuth()
    const isOwner = role === 'OWNER'
    const { isDark } = useTheme()
    const ordersRef = useRef(orders)
    ordersRef.current = orders

    const fetchOrders = async () => {
        try {
            const res = await api.get('/api/orders', {
                params: { restaurant_id: effectiveRestaurantId },
            })
            // Only show active orders for kitchen
            setOrders(res.data.filter(o => ['PLACED', 'CONFIRMED', 'PREPARING', 'READY'].includes(o.status)))
        } catch (err) {
            console.error('Failed to fetch orders:', err)
        }
    }

    useEffect(() => { fetchOrders() }, [])

    useEffect(() => {
        if (!socket) return

        const handleNewOrder = (data) => {
            setOrders(prev => {
                if (prev.find(o => o.id === data.order_id)) return prev
                const newOrder = {
                    id: data.order_id,
                    status: data.status,
                    table_number: data.table_number,
                    total_amount: data.total_amount,
                    customer_note: data.customer_note,
                    created_at: data.created_at,
                    items: data.items?.map(i => ({ item_name: i.name, quantity: i.quantity, customization: i.customization })) || [],
                }
                return [newOrder, ...prev]
            })
            setHighlightId(data.order_id)
            setTimeout(() => setHighlightId(null), 2000)
            playDing()
            toast(`New order from ${data.table_number}!`, { icon: '🆕' })
        }

        const handleOrderUpdated = (data) => {
            setOrders(prev => prev.map(o =>
                o.id === data.order_id
                    ? { ...o, status: data.status }
                    : o
            ).filter(o => ['PLACED', 'CONFIRMED', 'PREPARING', 'READY'].includes(o.status)))
        }

        socket.on('order:new', handleNewOrder)
        socket.on('order:updated', handleOrderUpdated)

        return () => {
            socket.off('order:new', handleNewOrder)
            socket.off('order:updated', handleOrderUpdated)
        }
    }, [socket])

    const updateStatus = async (order, newStatus) => {
        try {
            await api.patch(`/api/orders/${order.id}/status`, { status: newStatus })
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to update status')
        }
    }

    const executeAction = async () => {
        if (!confirmAction) return
        setActionLoading(true)
        const { type, order } = confirmAction
        try {
            await api.post(`/api/orders/${order.id}/${type}`)
            toast.success(type === 'cancel' ? 'Order cancelled' : 'Order removed')
            setOrders(prev => prev.filter(o => o.id !== order.id))
            setConfirmAction(null)
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Action failed')
        } finally {
            setActionLoading(false)
        }
    }

    const newOrders = orders.filter(o => o.status === 'PLACED' || o.status === 'CONFIRMED')
    const preparing = orders.filter(o => o.status === 'PREPARING')
    const ready = orders.filter(o => o.status === 'READY')

    const COLUMNS = [
        { title: 'New', count: newOrders.length, items: newOrders, actionLabel: 'Start Preparing', onAction: (o) => updateStatus(o, o.status === 'PLACED' ? 'CONFIRMED' : 'PREPARING'), accent: '#2563EB' },
        { title: 'Preparing', count: preparing.length, items: preparing, actionLabel: 'Mark Ready', onAction: (o) => updateStatus(o, 'READY'), accent: '#D97706' },
        { title: 'Ready', count: ready.length, items: ready, actionLabel: null, onAction: () => { }, accent: '#059669' },
    ]

    return (
        <div>
            <div className="page-header-bar">
                <h1 className="page-title">Kitchen</h1>
                <span className={`live-pill${isConnected ? '' : ' offline'}`}>
                    {isConnected ? 'Live' : 'Disconnected'}
                </span>
            </div>

            <div style={{ padding: '20px 28px 40px', display: 'flex', gap: 16, overflowX: 'auto' }}>
                {COLUMNS.map(col => (
                    <div key={col.title} style={{ flex: 1, minWidth: 260 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                                {col.title}
                            </h2>
                            <span style={{
                                fontSize: 12, fontWeight: 700, padding: '1px 8px', borderRadius: 20,
                                background: col.accent + (isDark ? '18' : '30'), color: col.accent,
                            }}>{col.count}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {col.items.length === 0 && (
                                <p style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>No orders</p>
                            )}
                            {col.items.map(order => (
                                <div key={order.id}>
                                    <OrderCard
                                        order={order}
                                        actionLabel={col.actionLabel}
                                        onAction={col.onAction}
                                        highlight={highlightId === order.id}
                                    />
                                    {isOwner && (
                                        <div style={{ display: 'flex', gap: 6, marginTop: 4, paddingLeft: 2 }}>
                                            <button
                                                onClick={() => setConfirmAction({ type: 'cancel', order })}
                                                style={{ fontSize: 11, color: '#DC2626', background: 'none', border: '1px solid #FCA5A5', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => setConfirmAction({ type: 'remove', order })}
                                                style={{ fontSize: 11, color: '#6B7280', background: 'none', border: '1px solid #D1D5DB', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {confirmAction && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setConfirmAction(null)} />
                    <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 380, padding: 24, borderRadius: 14, boxShadow: 'var(--shadow-xl)' }}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                            {confirmAction.type === 'cancel' ? 'Cancel Order?' : 'Remove Order?'}
                        </h2>
                        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>
                            Table {confirmAction.order.table_number}
                        </p>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                            {confirmAction.type === 'cancel'
                                ? 'The customer will see their order as cancelled.'
                                : 'This order will be hidden from all views.'}
                        </p>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => setConfirmAction(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                                Keep Order
                            </button>
                            <button
                                onClick={executeAction}
                                disabled={actionLoading}
                                className="btn btn-primary"
                                style={{ flex: 1, background: confirmAction.type === 'cancel' ? '#DC2626' : '#6B7280', borderColor: confirmAction.type === 'cancel' ? '#DC2626' : '#6B7280' }}
                            >
                                {actionLoading ? 'Processing...' : confirmAction.type === 'cancel' ? 'Cancel Order' : 'Remove'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
