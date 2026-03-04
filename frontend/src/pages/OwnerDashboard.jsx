import { useState, useEffect } from 'react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import useSocket from '../hooks/useSocket'
import StatusBadge from '../components/StatusBadge'
import DashboardNavbar from '../components/DashboardNavbar'

export default function OwnerDashboard() {
    const [orders, setOrders] = useState([])
    const [filter, setFilter] = useState('all')
    const { socket, isConnected } = useSocket()
    const { effectiveRestaurantId } = useAuth()

    const fetchOrders = async () => {
        try {
            const today = new Date().toISOString().split('T')[0]
            const res = await api.get('/api/orders', {
                params: { restaurant_id: effectiveRestaurantId, date: today },
            })
            setOrders(res.data)
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
                    items: data.items?.map(i => ({ item_name: i.name, quantity: i.quantity })) || [],
                }
                return [newOrder, ...prev]
            })
        }

        const handleOrderUpdated = (data) => {
            setOrders(prev => prev.map(o =>
                o.id === data.order_id ? { ...o, status: data.status } : o
            ))
        }

        socket.on('order:new', handleNewOrder)
        socket.on('order:updated', handleOrderUpdated)
        return () => {
            socket.off('order:new', handleNewOrder)
            socket.off('order:updated', handleOrderUpdated)
        }
    }, [socket])

    const filteredOrders = orders.filter(o => {
        if (filter === 'active') return o.status !== 'DELIVERED'
        if (filter === 'completed') return o.status === 'DELIVERED'
        return true
    })

    const totalOrders = orders.length
    const revenue = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
    const activeOrders = orders.filter(o => o.status !== 'DELIVERED').length
    const avgValue = totalOrders > 0 ? revenue / totalOrders : 0

    const StatCard = ({ label, value }) => (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
    )

    return (
        <div className="min-h-screen bg-gray-50">
            <DashboardNavbar />
            <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
                <h1 className="text-xl font-bold text-gray-900">📊 Owner Dashboard</h1>
                <span className={`text-xs px-2 py-1 rounded-full ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {isConnected ? '● Live' : '● Disconnected'}
                </span>
            </div>

            <div className="p-4 md:p-6 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard label="Total Orders" value={totalOrders} />
                    <StatCard label="Revenue" value={`₹${revenue.toFixed(0)}`} />
                    <StatCard label="Active Orders" value={activeOrders} />
                    <StatCard label="Avg Order Value" value={`₹${avgValue.toFixed(0)}`} />
                </div>

                {/* Filter */}
                <div className="flex gap-2">
                    {['all', 'active', 'completed'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${filter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Orders table */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 text-left">
                                    <th className="px-4 py-3 font-medium text-gray-500">Time</th>
                                    <th className="px-4 py-3 font-medium text-gray-500">Table</th>
                                    <th className="px-4 py-3 font-medium text-gray-500">Items</th>
                                    <th className="px-4 py-3 font-medium text-gray-500">Status</th>
                                    <th className="px-4 py-3 font-medium text-gray-500 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-gray-400">No orders today</td>
                                    </tr>
                                )}
                                {filteredOrders.map(order => (
                                    <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                                        <td className="px-4 py-3 text-gray-600">
                                            {order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-900">{order.table_number || '-'}</td>
                                        <td className="px-4 py-3 text-gray-600">{order.items?.length || 0} items</td>
                                        <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                                        <td className="px-4 py-3 text-right font-medium text-gray-900">₹{Number(order.total_amount || 0).toFixed(0)}</td>
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
