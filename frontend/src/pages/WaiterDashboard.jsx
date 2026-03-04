import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import useSocket from '../hooks/useSocket'
import OrderCard from '../components/OrderCard'

const DING_SOUND = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczGjqIr9TJdUwvQG2Yvb6CUjQ4YJGztIxdRTtfkK+0i19GPGCQr7SLX0Y8YJCvtItfRjxgkK+0i19GO1+Pr7OMYEU+YJa3wpVmQD5gmbfCl2dEQGGbucifakg/YJm5xZdmQD5gmbnFl2Y/PV+YuMOUZEA+YZq5xJVlQD9imrrElWVAP2KausKTY0BAY5u7wpNjQEBjm7u/kGBBQmWdvL+QYEFCZZS1uIxeQ0NlnLzAkWFBQmWdvMCRYUFCZZ28v5BgQUJlnby/kGBBQmWcvL6PX0FDZZ28v5BgQkNmnry+'
const playDing = () => {
    try { new Audio(DING_SOUND).play() } catch { }
}

export default function WaiterDashboard() {
    const [orders, setOrders] = useState([])
    const [highlightId, setHighlightId] = useState(null)
    const { socket, isConnected } = useSocket()
    const { effectiveRestaurantId } = useAuth()
    const ordersRef = useRef(orders)
    ordersRef.current = orders

    const fetchOrders = async () => {
        try {
            const res = await api.get('/api/orders', {
                params: { restaurant_id: effectiveRestaurantId },
            })
            setOrders(res.data.filter(o => ['READY', 'PICKED_UP'].includes(o.status)))
        } catch (err) {
            console.error('Failed to fetch orders:', err)
        }
    }

    useEffect(() => { fetchOrders() }, [])

    useEffect(() => {
        if (!socket) return

        const handleOrderUpdated = (data) => {
            setOrders(prev => {
                let updated = prev.map(o =>
                    o.id === data.order_id ? { ...o, status: data.status } : o
                )
                if (data.status === 'READY' && !prev.find(o => o.id === data.order_id)) {
                    const newOrder = {
                        id: data.order_id,
                        status: data.status,
                        table_number: data.table_number,
                        total_amount: data.total_amount,
                        customer_note: data.customer_note,
                        created_at: data.created_at,
                        items: data.items?.map(i => ({ item_name: i.name, quantity: i.quantity, customization: i.customization })) || [],
                    }
                    updated = [newOrder, ...updated]
                    setHighlightId(data.order_id)
                    setTimeout(() => setHighlightId(null), 2000)
                    playDing()
                    toast(`Order ready for ${data.table_number}!`, { icon: '🔔' })

                    if (Notification.permission === 'granted') {
                        new Notification('Order Ready!', { body: `Table ${data.table_number} is ready for pickup` })
                    } else if (Notification.permission !== 'denied') {
                        Notification.requestPermission()
                    }
                }
                return updated.filter(o => ['READY', 'PICKED_UP'].includes(o.status))
            })
        }

        socket.on('order:updated', handleOrderUpdated)
        return () => { socket.off('order:updated', handleOrderUpdated) }
    }, [socket])

    const updateStatus = async (order, newStatus) => {
        try {
            await api.patch(`/api/orders/${order.id}/status`, { status: newStatus })
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to update status')
        }
    }

    const readyOrders = orders.filter(o => o.status === 'READY')
    const pickedUp = orders.filter(o => o.status === 'PICKED_UP')

    return (
        <div>
            <div className="page-header-bar">
                <h1 className="page-title">Waiter</h1>
                <span className={`live-pill${isConnected ? '' : ' offline'}`}>
                    {isConnected ? 'Live' : 'Disconnected'}
                </span>
            </div>

            {readyOrders.length === 0 && pickedUp.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center' }}>
                    <p style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>All clear!</p>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>No pending orders right now.</p>
                </div>
            ) : (
                <div style={{ padding: '20px 28px 40px', display: 'flex', flexDirection: 'column', gap: 28 }}>
                    {readyOrders.length > 0 && (
                        <section>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    Ready for Pickup
                                </h2>
                                <span className="badge badge-ready">{readyOrders.length}</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                                {readyOrders.map(order => (
                                    <OrderCard key={order.id} order={order}
                                        actionLabel="Mark Picked Up"
                                        onAction={(o) => updateStatus(o, 'PICKED_UP')}
                                        highlight={highlightId === order.id} />
                                ))}
                            </div>
                        </section>
                    )}

                    {pickedUp.length > 0 && (
                        <section>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    In Progress
                                </h2>
                                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>({pickedUp.length})</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                                {pickedUp.map(order => (
                                    <OrderCard key={order.id} order={order}
                                        actionLabel="Mark Delivered"
                                        onAction={(o) => updateStatus(o, 'DELIVERED')}
                                        highlight={highlightId === order.id} />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}
        </div>
    )
}
