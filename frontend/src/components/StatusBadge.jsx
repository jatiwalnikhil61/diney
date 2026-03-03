const statusConfig = {
    PLACED: { label: 'Placed', bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500' },
    CONFIRMED: { label: 'Confirmed', bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
    PREPARING: { label: 'Preparing', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
    READY: { label: 'Ready', bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
    PICKED_UP: { label: 'Picked Up', bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
    DELIVERED: { label: 'Delivered', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-600' },
}

export default function StatusBadge({ status }) {
    const config = statusConfig[status] || statusConfig.PLACED
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {config.label}
        </span>
    )
}
