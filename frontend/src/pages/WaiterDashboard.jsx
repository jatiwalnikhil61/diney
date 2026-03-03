import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api, { RESTAURANT_ID } from '../services/api'
import useSocket from '../hooks/useSocket'
import OrderCard from '../components/OrderCard'

export default function WaiterDashboard() {
    const [orders, setOrders] = useState([])
    const { socket, isConnected } = useSocket()

    const fetchOrders = async () => {
        try {
            const res = await api.get('/api/orders', {
                params: { restaurant_id: RESTAURANT_ID },
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
                // If a new READY order arrived that we don't have, add it
                if (data.status === 'READY' && !prev.find(o => o.id === data.order_id)) {
                    updated = [{
                        id: data.order_id,
                        status: data.status,
                        table_number: data.table_number,
                        total_amount: data.total_amount,
                        customer_note: data.customer_note,
                        created_at: data.created_at,
                        items: data.items?.map(i => ({ item_name: i.name, quantity: i.quantity, customization: i.customization })) || [],
                    }, ...updated]
                    toast(`Order ready for ${data.table_number}!`, { icon: '🔔' })

                    // Browser notification
                    if (Notification.permission === 'granted') {
                        new Notification('Order Ready!', { body: `Table ${data.table_number} is ready for pickup` })
                    } else if (Notification.permission !== 'denied') {
                        Notification.requestPermission()
                    }
                }
                // Filter to only show READY and PICKED_UP
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

    if (readyOrders.length === 0 && pickedUp.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900">🍽️ Waiter Dashboard</h1>
                    <span className={`text-xs px-2 py-1 rounded-full ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {isConnected ? '● Live' : '● Disconnected'}
                    </span>
                </div>
                <div className="flex flex-col items-center justify-center h-[70vh] text-center">
                    <p className="text-5xl mb-4">🎉</p>
                    <p className="text-lg font-semibold text-gray-900">All clear!</p>
                    <p className="text-sm text-gray-500">No pending orders.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                <h1 className="text-xl font-bold text-gray-900">🍽️ Waiter Dashboard</h1>
                <span className={`text-xs px-2 py-1 rounded-full ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {isConnected ? '● Live' : '● Disconnected'}
                </span>
            </div>

            <div className="p-4 md:p-6 space-y-6">
                {/* Ready for Pickup */}
                {readyOrders.length > 0 && (
                    <section>
                        <h2 className="text-base font-bold text-gray-900 mb-3">
                            🔔 Ready for Pickup
                            <span className="ml-2 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">{readyOrders.length}</span>
                        </h2>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {readyOrders.map(order => (
                                <OrderCard
                                    key={order.id}
                                    order={order}
                                    actionLabel="Mark Picked Up"
                                    onAction={(o) => updateStatus(o, 'PICKED_UP')}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* In Progress */}
                {pickedUp.length > 0 && (
                    <section>
                        <h2 className="text-base font-bold text-gray-900 mb-3">
                            In Progress
                            <span className="ml-2 text-xs font-normal text-gray-400">({pickedUp.length})</span>
                        </h2>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {pickedUp.map(order => (
                                <OrderCard
                                    key={order.id}
                                    order={order}
                                    actionLabel="Mark Delivered ✓"
                                    onAction={(o) => updateStatus(o, 'DELIVERED')}
                                />
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    )
}
