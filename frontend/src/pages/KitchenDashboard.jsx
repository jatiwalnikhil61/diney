import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import api, { RESTAURANT_ID } from '../services/api'
import useSocket from '../hooks/useSocket'
import OrderCard from '../components/OrderCard'

// Tiny base64 ding sound
const DING_SOUND = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczGjqIr9TJdUwvQG2Yvb6CUjQ4YJGztIxdRTtfkK+0i19GPGCQr7SLX0Y8YJCvtItfRjxgkK+0i19GO1+Pr7OMYEU+YJa3wpVmQD5gmbfCl2dEQGGbucifakg/YJm5xZdmQD5gmbnFl2Y/PV+YuMOUZEA+YZq5xJVlQD9imrrElWVAP2KausKTY0BAY5u7wpNjQEBjm7u/kGBBQmWdvL+QYEFCZZS1uIxeQ0NlnLzAkWFBQmWdvMCRYUFCZZ28v5BgQUJlnby/kGBBQmWcvL6PX0FDZZ28v5BgQkNmnry+'
const playDing = () => {
    try { new Audio(DING_SOUND).play() } catch { }
}

const STATUS_MAP = {
    PLACED: 'new',
    CONFIRMED: 'new',
    PREPARING: 'preparing',
    READY: 'ready',
}

export default function KitchenDashboard() {
    const [orders, setOrders] = useState([])
    const [highlightId, setHighlightId] = useState(null)
    const { socket, isConnected } = useSocket()
    const ordersRef = useRef(orders)
    ordersRef.current = orders

    const fetchOrders = async () => {
        try {
            const res = await api.get('/api/orders', {
                params: { restaurant_id: RESTAURANT_ID },
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

    const Column = ({ title, items, actionLabel, onAction }) => (
        <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-900 mb-3 px-1">{title}
                <span className="ml-2 text-xs font-normal text-gray-400">({items.length})</span>
            </h2>
            <div className="space-y-3">
                {items.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-8">No orders</p>
                )}
                {items.map(order => (
                    <OrderCard
                        key={order.id}
                        order={order}
                        actionLabel={actionLabel}
                        onAction={onAction}
                        highlight={highlightId === order.id}
                    />
                ))}
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                <h1 className="text-xl font-bold text-gray-900">👨‍🍳 Kitchen Dashboard</h1>
                <span className={`text-xs px-2 py-1 rounded-full ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {isConnected ? '● Live' : '● Disconnected'}
                </span>
            </div>

            <div className="p-4 md:p-6 flex flex-col md:flex-row gap-4 md:gap-6">
                <Column
                    title="🆕 New"
                    items={newOrders}
                    actionLabel="Start Preparing"
                    onAction={(order) => {
                        const next = order.status === 'PLACED' ? 'CONFIRMED' : 'PREPARING'
                        updateStatus(order, next)
                    }}
                />
                <Column
                    title="👨‍🍳 Preparing"
                    items={preparing}
                    actionLabel="Mark Ready ✓"
                    onAction={(order) => updateStatus(order, 'READY')}
                />
                <Column
                    title="✅ Ready"
                    items={ready}
                    actionLabel={null}
                    onAction={() => { }}
                />
            </div>
        </div>
    )
}
