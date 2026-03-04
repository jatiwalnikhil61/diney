const STATUS_CLASS = {
    PLACED:    'badge badge-placed',
    CONFIRMED: 'badge badge-confirmed',
    PREPARING: 'badge badge-preparing',
    READY:     'badge badge-ready',
    PICKED_UP: 'badge badge-pickedup',
    DELIVERED: 'badge badge-delivered',
}

const STATUS_LABEL = {
    PLACED:    'Placed',
    CONFIRMED: 'Confirmed',
    PREPARING: 'Preparing',
    READY:     'Ready',
    PICKED_UP: 'Picked Up',
    DELIVERED: 'Delivered',
}

export default function StatusBadge({ status }) {
    return (
        <span className={STATUS_CLASS[status] || 'badge badge-placed'}>
            {STATUS_LABEL[status] || status}
        </span>
    )
}
