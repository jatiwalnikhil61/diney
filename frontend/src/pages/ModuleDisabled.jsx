import { useNavigate } from 'react-router-dom'

const MODULE_LABELS = {
    kitchen_module: 'Kitchen Dashboard',
    waiter_module: 'Waiter Dashboard',
    owner_dashboard: 'Owner Dashboard',
    customer_status_tracking: 'Customer Status Tracking',
    menu_management: 'Menu Management',
    staff_management: 'Staff Management',
}

export default function ModuleDisabled({ moduleName }) {
    const navigate = useNavigate()
    const label = MODULE_LABELS[moduleName] || moduleName

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            textAlign: 'center',
            padding: 40,
        }}>
            <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'var(--stone-100)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
                fontSize: 36,
            }}>
                🔒
            </div>
            <h2 style={{
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--stone-900)',
                marginBottom: 8,
            }}>
                Module Not Available
            </h2>
            <p style={{
                fontSize: 16,
                color: 'var(--stone-500)',
                maxWidth: 400,
                marginBottom: 32,
                lineHeight: 1.5,
            }}>
                The <strong>{label}</strong> module is not enabled for your restaurant.
                Contact your administrator to enable this feature.
            </p>
            <button
                onClick={() => navigate('/dashboard')}
                style={{
                    padding: '12px 32px',
                    background: 'var(--cardamom)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                }}
            >
                Go to Dashboard
            </button>
        </div>
    )
}
