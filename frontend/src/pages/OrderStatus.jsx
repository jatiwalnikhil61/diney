import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'

const STEPS = [
    { status: 'PLACED', label: 'Placed', icon: '📝' },
    { status: 'CONFIRMED', label: 'Confirmed', icon: '✅' },
    { status: 'PREPARING', label: 'Preparing', icon: '👨‍🍳' },
    { status: 'READY', label: 'Ready for Pickup', icon: '🔔' },
    { status: 'PICKED_UP', label: 'On the Way', icon: '🚶' },
    { status: 'DELIVERED', label: 'Delivered', icon: '🍽️' },
]

export default function OrderStatus() {
    const { qrToken, orderId } = useParams()
    const navigate = useNavigate()
    const [orderStatus, setOrderStatus] = useState(null)
    const [lastUpdated, setLastUpdated] = useState(null)

    const fetchStatus = async () => {
        try {
            const res = await api.get(`/api/public/orders/${orderId}/status`)
            setOrderStatus(res.data)
            setLastUpdated(new Date())
        } catch {
            // silently fail on poll
        }
    }

    useEffect(() => {
        fetchStatus()
        const interval = setInterval(fetchStatus, 5000)
        return () => clearInterval(interval)
    }, [orderId])

    if (!orderStatus) {
        return (
            <div className="min-h-screen bg-gray-50 p-6 animate-pulse">
                <div className="max-w-md mx-auto space-y-6">
                    <div className="text-center space-y-2">
                        <div className="h-10 w-10 bg-gray-200 rounded-full mx-auto" />
                        <div className="h-6 bg-gray-200 rounded w-40 mx-auto" />
                        <div className="h-4 bg-gray-200 rounded w-24 mx-auto" />
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-gray-200 rounded-full shrink-0" />
                                <div className="h-4 bg-gray-200 rounded w-24" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    const currentIdx = STEPS.findIndex(s => s.status === orderStatus.status)
    const isDelivered = orderStatus.status === 'DELIVERED'
    const isReady = orderStatus.status === 'READY'

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-md mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <p className="text-4xl mb-2">
                        {isDelivered ? '🍽️' : isReady ? '🔔' : '🎉'}
                    </p>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {isDelivered ? 'Enjoy your meal!' : isReady ? 'Your order is ready!' : 'Order Placed!'}
                    </h1>
                    <p className="text-xs text-gray-400 mt-2 font-mono">Order #{orderId.slice(0, 8)}</p>
                    {lastUpdated && !isDelivered && (
                        <div className="flex items-center justify-center gap-1.5 mt-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-xs text-gray-400">
                                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                        </div>
                    )}
                </div>

                {/* Status stepper */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="space-y-0">
                        {STEPS.map((step, idx) => {
                            const isReached = idx <= currentIdx
                            const isCurrent = idx === currentIdx
                            const isLast = idx === STEPS.length - 1

                            return (
                                <div key={step.status} className="flex items-stretch">
                                    {/* Left: timeline */}
                                    <div className="flex flex-col items-center mr-4">
                                        <div
                                            className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 transition-all ${isCurrent
                                                ? 'bg-gray-900 text-white ring-4 ring-gray-200'
                                                : isReached
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-gray-100 text-gray-400'
                                                } ${isCurrent && !isDelivered ? 'animate-pulse' : ''}`}
                                        >
                                            {step.icon}
                                        </div>
                                        {!isLast && (
                                            <div className={`w-0.5 flex-1 min-h-6 my-1 transition-colors duration-500 ${isReached && idx < currentIdx ? 'bg-green-300' : 'bg-gray-200'}`} />
                                        )}
                                    </div>

                                    {/* Right: label */}
                                    <div className="pt-2 pb-4">
                                        <p className={`text-sm font-medium ${isReached ? 'text-gray-900' : 'text-gray-400'}`}>
                                            {step.label}
                                        </p>
                                        {isCurrent && (
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {orderStatus.updated_at
                                                    ? new Date(orderStatus.updated_at).toLocaleTimeString()
                                                    : 'Just now'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Action */}
                <div className="mt-6 text-center">
                    <button
                        onClick={() => navigate(`/menu/${qrToken}`)}
                        className="px-6 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors cursor-pointer"
                    >
                        Order something else
                    </button>
                </div>
            </div>
        </div>
    )
}
