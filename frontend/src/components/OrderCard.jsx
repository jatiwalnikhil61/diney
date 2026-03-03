import { useState, useEffect } from 'react'
import StatusBadge from './StatusBadge'

function timeAgo(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return `${diff}s ago`
    const mins = Math.floor(diff / 60)
    return `${mins} min ago`
}

export default function OrderCard({ order, actionLabel, onAction, highlight }) {
    const [elapsed, setElapsed] = useState(timeAgo(order.created_at))
    const isOld = (Date.now() - new Date(order.created_at).getTime()) > 15 * 60 * 1000

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(timeAgo(order.created_at))
        }, 10000)
        return () => clearInterval(interval)
    }, [order.created_at])

    return (
        <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-500 ${highlight ? 'ring-2 ring-amber-400 bg-amber-50' : ''}`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-bold text-gray-900">{order.table_number}</span>
                <StatusBadge status={order.status} />
            </div>

            <p className={`text-xs mb-2 ${isOld ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                {elapsed}
            </p>

            <ul className="text-sm text-gray-700 mb-2 space-y-0.5">
                {order.items?.map((item, i) => (
                    <li key={i}>{item.quantity}× {item.name || item.item_name}</li>
                ))}
            </ul>

            {order.customer_note && (
                <p className="text-xs italic text-gray-500 mb-3 border-l-2 border-gray-300 pl-2">
                    {order.customer_note}
                </p>
            )}

            {order.total_amount && (
                <p className="text-sm font-semibold text-gray-800 mb-3">₹{order.total_amount}</p>
            )}

            {actionLabel && (
                <button
                    onClick={() => onAction(order)}
                    className="w-full py-2 px-4 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors cursor-pointer"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    )
}
