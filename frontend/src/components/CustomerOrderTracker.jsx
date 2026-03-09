import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import api from '../services/api'
import { useCustomerAuth } from '../context/CustomerAuthContext'

const STATUS_CONFIG = {
    PLACED:     { label: 'Order received',        color: '#F59E0B', pulse: true },
    CONFIRMED:  { label: 'Confirmed by kitchen',  color: '#F59E0B', pulse: false },
    PREPARING:  { label: 'Being prepared',        color: '#D97706', pulse: true },
    READY:      { label: "Ready — on its way!",   color: '#10B981', pulse: true },
    PICKED_UP:  { label: 'Picked up',             color: '#10B981', pulse: false },
    DELIVERED:  { label: 'Delivered',             color: '#059669', pulse: false },
    CANCELLED:  { label: 'Order cancelled',       color: '#EF4444', pulse: false },
}

const TERMINAL_STATUSES = ['DELIVERED', 'PICKED_UP', 'CANCELLED']

function StatusDot({ status }) {
    const cfg = STATUS_CONFIG[status] || { color: '#9CA3AF', pulse: false }
    return (
        <span style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: cfg.color,
            marginRight: 6,
            flexShrink: 0,
            animation: cfg.pulse ? 'customerPulse 1.4s ease-in-out infinite' : 'none',
        }} />
    )
}

function formatDateTime(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) +
        ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export default function CustomerOrderTracker({ restaurantId, onOrdersLoaded }) {
    const { customer, logout } = useCustomerAuth()
    const [currentOrder, setCurrentOrder] = useState(null)
    const [pastOrders, setPastOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const socketRef = useRef(null)

    const fetchOrders = async () => {
        try {
            const res = await api.get('/api/customer/orders', { params: { restaurant_id: restaurantId } })
            setCurrentOrder(res.data.current_order)
            setPastOrders(res.data.past_orders)
            onOrdersLoaded?.(res.data.current_order)
        } catch {
            onOrdersLoaded?.(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchOrders()
    }, [restaurantId])

    // Socket.IO — listen for order status updates
    useEffect(() => {
        if (!restaurantId) return

        const socket = io(import.meta.env.VITE_API_URL, {
            auth: { restaurant_id: restaurantId },
            transports: ['websocket', 'polling'],
        })

        socket.on('order:updated', (data) => {
            setCurrentOrder(prev => {
                if (!prev || prev.id !== data.order_id) return prev
                if (TERMINAL_STATUSES.includes(data.status)) {
                    const done = { ...prev, status: data.status }
                    setPastOrders(old => [done, ...old].slice(0, 3))
                    onOrdersLoaded?.(null)
                    return null
                }
                return { ...prev, status: data.status }
            })
        })

        socketRef.current = socket
        return () => {
            socket.off('order:updated')
            socket.disconnect()
        }
    }, [restaurantId])

    const card = {
        background: '#fff',
        borderRadius: 14,
        border: '1px solid #F3F4F6',
        padding: '16px',
        marginBottom: 12,
    }

    if (loading) return null

    const isCancelled = currentOrder?.status === 'CANCELLED'

    return (
        <>
            {/* Pulse keyframe */}
            <style>{`
                @keyframes customerPulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50%       { opacity: 0.5; transform: scale(1.3); }
                }
            `}</style>

            <div style={{ padding: '0 16px 100px' }}>
                <div style={{ borderTop: '1px solid #F3F4F6', marginBottom: 20, paddingTop: 28 }}>
                    <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 4 }}>
                        Your Orders
                    </h2>
                    {customer?.name && (
                        <p style={{ fontSize: 13, color: '#6B7280' }}>
                            Hi {customer.name}, here are your orders
                        </p>
                    )}
                </div>

                {/* Current order */}
                {currentOrder && (
                    <div style={{
                        ...card,
                        border: isCancelled ? '1.5px solid #FCA5A520' : '1.5px solid #F59E0B20',
                        background: isCancelled ? '#FFF5F5' : '#FFFBF0',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
                                {isCancelled ? 'Order cancelled' : 'Order in progress'}
                            </span>
                            {currentOrder.table_number && (
                                <span style={{ fontSize: 12, color: '#6B7280', background: '#F3F4F6', padding: '2px 8px', borderRadius: 20 }}>
                                    Table {currentOrder.table_number}
                                </span>
                            )}
                        </div>

                        <div style={{ marginBottom: 10 }}>
                            {currentOrder.items.map((item, i) => (
                                <div key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 2 }}>
                                    {item.quantity}× {item.name}
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>
                                <StatusDot status={currentOrder.status} />
                                <span style={{ color: STATUS_CONFIG[currentOrder.status]?.color || '#6B7280', fontWeight: 600 }}>
                                    {STATUS_CONFIG[currentOrder.status]?.label || currentOrder.status}
                                </span>
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>
                                ₹{Number(currentOrder.total_amount).toFixed(0)}
                            </span>
                        </div>
                    </div>
                )}

                {/* Past orders */}
                {pastOrders.map(order => {
                    const cfg = STATUS_CONFIG[order.status]
                    const cancelled = order.status === 'CANCELLED'
                    return (
                        <div key={order.id} style={card}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                <span style={{ fontSize: 12, color: '#9CA3AF' }}>{formatDateTime(order.created_at)}</span>
                                <span style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: cancelled ? '#DC2626' : '#059669',
                                    background: cancelled ? '#FEE2E2' : '#D1FAE5',
                                    padding: '2px 8px',
                                    borderRadius: 20,
                                }}>
                                    {cfg?.label || order.status}
                                </span>
                            </div>
                            <p style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>
                                {order.items.map(i => `${i.quantity}× ${i.name}`).join(', ')}
                            </p>
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: 0 }}>
                                ₹{Number(order.total_amount).toFixed(0)}
                            </p>
                        </div>
                    )
                })}

                {/* Empty state */}
                {!currentOrder && pastOrders.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: 14 }}>
                        No orders yet. Browse the menu above to place your first order!
                    </div>
                )}

                {/* Sign out */}
                <div style={{ textAlign: 'center', marginTop: 24 }}>
                    <button
                        onClick={logout}
                        style={{ background: 'none', border: 'none', fontSize: 13, color: '#9CA3AF', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                        Not you? Sign out
                    </button>
                </div>
            </div>
        </>
    )
}
