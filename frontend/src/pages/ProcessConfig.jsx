import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const ModuleIcon = ({ d, size = 28, stroke = 'var(--cardamom)' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke}
        strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
    </svg>
)

const MODULE_INFO = {
    kitchen_module: {
        label: 'Kitchen Dashboard',
        description: 'Manage kitchen workflow. Orders flow to kitchen screen for chefs.',
        icon: 'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z',
    },
    waiter_module: {
        label: 'Waiter Dashboard',
        description: 'Waiter receives notifications when orders are ready.',
        icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    },
    owner_dashboard: {
        label: 'Owner Dashboard',
        description: 'View analytics, orders, and restaurant overview.',
        icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    },
    customer_status_tracking: {
        label: 'Customer Status Tracking',
        description: 'Customers can track their order status after placing.',
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    },
    menu_management: {
        label: 'Menu Management',
        description: 'Create and manage menu categories and items.',
        icon: 'M4 6h16M4 10h16M4 14h16M4 18h16',
    },
    staff_management: {
        label: 'Staff Management',
        description: 'Add and manage restaurant staff members.',
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0',
    },
}

const MODULE_KEYS = Object.keys(MODULE_INFO)

export default function ProcessConfig() {
    const { token, effectiveRestaurantId, updateModules, role } = useAuth()
    const { isDark } = useTheme()
    const [config, setConfig] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(null) // which key is saving
    const [error, setError] = useState(null)
    const [toast, setToast] = useState(null)

    const fetchConfig = useCallback(async () => {
        try {
            const url = role === 'SUPER_ADMIN'
                ? `${API}/api/superadmin/restaurants/${effectiveRestaurantId}/config`
                : `${API}/api/restaurants/config/me?restaurant_id=${effectiveRestaurantId}`
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (!res.ok) throw new Error('Failed to load config')
            const data = await res.json()
            setConfig(data)
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, [token, effectiveRestaurantId, role])

    useEffect(() => { fetchConfig() }, [fetchConfig])

    const toggleModule = async (key) => {
        if (!config.can_edit && role !== 'SUPER_ADMIN') return
        const newValue = !config[key]

        // Waiter can't be ON if kitchen is OFF
        if (key === 'waiter_module' && newValue && !config.kitchen_module) {
            showToast('Kitchen module must be enabled before enabling Waiter module', 'warning')
            return
        }

        setSaving(key)
        try {
            const url = role === 'SUPER_ADMIN'
                ? `${API}/api/superadmin/restaurants/${effectiveRestaurantId}/config`
                : `${API}/api/restaurants/config/me?restaurant_id=${effectiveRestaurantId}`
            const res = await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ [key]: newValue }),
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.detail || 'Failed to update')
            }
            const data = await res.json()
            setConfig(data)

            // Update auth context modules if not super admin
            if (role !== 'SUPER_ADMIN') {
                const newModules = {}
                MODULE_KEYS.forEach(k => { newModules[k] = data[k] })
                updateModules(newModules)
            }

            // If kitchen was turned off, waiter was auto-disabled
            if (key === 'kitchen_module' && !newValue && data.waiter_auto_disabled) {
                showToast('Kitchen disabled — Waiter module was automatically disabled', 'warning')
            } else {
                showToast(`${MODULE_INFO[key].label} ${newValue ? 'enabled' : 'disabled'}`, 'success')
            }
        } catch (e) {
            showToast(e.message, 'error')
        } finally {
            setSaving(null)
        }
    }

    const showToast = (message, type) => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    if (loading) return (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--stone-500)' }}>
            Loading configuration...
        </div>
    )

    if (error) return (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--red-500, #ef4444)' }}>
            {error}
        </div>
    )

    const canEdit = config?.can_edit || role === 'SUPER_ADMIN'

    return (
        <div style={{ padding: '24px 32px', maxWidth: 900 }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--stone-900)', marginBottom: 4 }}>
                    Process Configuration
                </h1>
                <p style={{ fontSize: 14, color: 'var(--stone-500)' }}>
                    Enable or disable modules for your restaurant. Changes take effect immediately.
                </p>
                {!canEdit && (
                    <div style={{
                        marginTop: 12,
                        padding: '10px 16px',
                        borderRadius: 8,
                        background: 'var(--stone-100)',
                        color: 'var(--stone-600)',
                        fontSize: 13,
                    }}>
                        🔒 Configuration changes are disabled. Contact your administrator.
                    </div>
                )}
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                gap: 16,
            }}>
                {MODULE_KEYS.map(key => {
                    const info = MODULE_INFO[key]
                    const isOn = config[key]
                    const isSaving = saving === key
                    const isWaiterBlocked = key === 'waiter_module' && !config.kitchen_module

                    return (
                        <div key={key} style={{
                            padding: 20,
                            borderRadius: 12,
                            border: `1px solid ${isOn ? 'var(--cardamom)' : 'var(--stone-200)'}`,
                            background: 'var(--stone-50)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            opacity: isSaving ? 0.6 : 1,
                            transition: 'all 0.2s',
                        }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.75)' : 'var(--cardamom)'}`, background: 'var(--stone-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <ModuleIcon d={info.icon} stroke={isDark ? 'rgba(255,255,255,0.9)' : 'var(--cardamom)'} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{
                                    fontSize: 15,
                                    fontWeight: 600,
                                    color: 'var(--stone-900)',
                                    marginBottom: 2,
                                }}>
                                    {info.label}
                                </div>
                                <div style={{
                                    fontSize: 13,
                                    color: 'var(--stone-500)',
                                    lineHeight: 1.4,
                                }}>
                                    {info.description}
                                </div>
                            </div>
                            <label style={{
                                position: 'relative',
                                display: 'inline-block',
                                width: 48,
                                height: 26,
                                flexShrink: 0,
                                cursor: canEdit && !isWaiterBlocked ? 'pointer' : 'not-allowed',
                                opacity: canEdit && !isWaiterBlocked ? 1 : 0.5,
                            }}>
                                <input
                                    type="checkbox"
                                    checked={isOn}
                                    onChange={() => toggleModule(key)}
                                    disabled={!canEdit || isWaiterBlocked || isSaving}
                                    style={{ display: 'none' }}
                                />
                                <span style={{
                                    position: 'absolute',
                                    inset: 0,
                                    borderRadius: 13,
                                    background: isOn ? 'var(--cardamom)' : 'var(--stone-300)',
                                    transition: 'background 0.2s',
                                }} />
                                <span className="toggle-dot" style={{
                                    position: 'absolute',
                                    top: 3,
                                    left: isOn ? 25 : 3,
                                    width: 20,
                                    height: 20,
                                    borderRadius: '50%',
                                    background: isDark ? '#1A2A24' : '#fff',
                                    transition: 'left 0.2s',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                }} />
                            </label>
                        </div>
                    )
                })}
            </div>

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    bottom: 24,
                    right: 24,
                    padding: '12px 20px',
                    borderRadius: 10,
                    background: toast.type === 'error' ? '#fef2f2' :
                        toast.type === 'warning' ? '#fffbeb' : '#f0fdf4',
                    color: toast.type === 'error' ? '#dc2626' :
                        toast.type === 'warning' ? '#d97706' : '#16a34a',
                    border: `1px solid ${toast.type === 'error' ? '#fecaca' :
                        toast.type === 'warning' ? '#fde68a' : '#86efac'}`,
                    fontSize: 14,
                    fontWeight: 500,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 9999,
                    animation: 'fadeIn 0.2s',
                }}>
                    {toast.message}
                </div>
            )}
        </div>
    )
}
