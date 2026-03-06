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
    try { new Audio(DING_SOUND).play() } catch { }
}


export default function KitchenDashboard() {
    const [orders, setOrders] = useState([])
    const [highlightId, setHighlightId] = useState(null)
    const { socket, isConnected } = useSocket()
    const { effectiveRestaurantId } = useAuth()
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
                                <OrderCard
                                    key={order.id}
                                    order={order}
                                    actionLabel={col.actionLabel}
                                    onAction={col.onAction}
                                    highlight={highlightId === order.id}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
