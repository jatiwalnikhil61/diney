import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import api from '../services/api'

// Icon components (simple SVG inline)
const Icon = ({ d, size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="sidebar-icon">
        <path d={d} />
    </svg>
)

const ICONS = {
    overview: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    orders: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    kitchen: 'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z',
    configure: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
    waiter: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    menu: 'M4 6h16M4 10h16M4 14h16M4 18h16',
    staff: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0',
    qr: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z',
    profile: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    sa_overview: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    restaurants: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    sun: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 110 8 4 4 0 010-8z',
    moon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
    logout: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
}

export default function Sidebar({ sidebarOpen, onToggle }) {
    const navigate = useNavigate()
    const { role, canAccessKitchen, canAccessWaiter, logout, restaurantName,
        setSelectedRestaurant, effectiveRestaurantId, isModuleEnabled, ownerCanConfigure } = useAuth()
    const { isDark, toggleDark } = useTheme()
    const [restaurants, setRestaurants] = useState([])

    useEffect(() => {
        if (role !== 'SUPER_ADMIN') return
        api.get('/api/restaurants').then(res => {
            setRestaurants(res.data)
            if (!effectiveRestaurantId && res.data.length > 0) {
                setSelectedRestaurant(res.data[0].id, res.data[0].name)
            }
        }).catch(() => { })
    }, [role])

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    const navLinkClass = ({ isActive }) =>
        `sidebar-item${isActive ? ' active' : ''}`

    return (
        <>
            {/* Toggle button — fixed, just outside sidebar edge */}
            <button
                onClick={onToggle}
                aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                style={{
                    position: 'fixed',
                    top: 'var(--space-5)',
                    left: sidebarOpen ? '244px' : '12px',
                    zIndex: 150,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--cardamom)',
                    color: isDark ? '#1A2A24' : 'white',
                    border: '2px solid rgba(255,255,255,0.2)',
                    boxShadow: 'var(--shadow-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: 12,
                    lineHeight: 1,
                    transition: 'left var(--transition-base)',
                }}
            >
                {sidebarOpen ? '←' : '→'}
            </button>

            <aside className="sidebar" style={{ transform: sidebarOpen ? 'translateX(0)' : 'translateX(-260px)' }}>
                {/* Brand */}
                <div className="sidebar-brand">
                    <div className="sidebar-brand-name">Diney</div>
                    {restaurantName && (
                        <div className="sidebar-brand-sub">{restaurantName}</div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    {/* Super Admin restaurant selector */}
                    {role === 'SUPER_ADMIN' && restaurants.length > 0 && (
                        <select
                            value={effectiveRestaurantId || ''}
                            onChange={e => {
                                const r = restaurants.find(r => r.id === e.target.value)
                                if (r) setSelectedRestaurant(r.id, r.name)
                            }}
                            className="sidebar-restaurant-select"
                        >
                            <option value="" disabled>Select restaurant</option>
                            {restaurants.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    )}

                    {/* OWNER nav */}
                    {role === 'OWNER' && (
                        <>
                            <div className="sidebar-section-label">Operations</div>
                            {isModuleEnabled('owner_dashboard') && (
                                <NavLink to="/dashboard" end className={navLinkClass}>
                                    <Icon d={ICONS.overview} /> Overview
                                </NavLink>
                            )}
                            {isModuleEnabled('owner_dashboard') && (
                                <NavLink to="/dashboard/orders" className={navLinkClass}>
                                    <Icon d={ICONS.orders} /> Order History
                                </NavLink>
                            )}
                            {canAccessKitchen && isModuleEnabled('kitchen_module') && (
                                <NavLink to="/dashboard/kitchen" className={navLinkClass}>
                                    <Icon d={ICONS.kitchen} /> Kitchen
                                </NavLink>
                            )}
                            {canAccessWaiter && isModuleEnabled('waiter_module') && (
                                <NavLink to="/dashboard/waiter" className={navLinkClass}>
                                    <Icon d={ICONS.waiter} /> Waiter
                                </NavLink>
                            )}

                            <div className="sidebar-section-label">Restaurant</div>
                            {isModuleEnabled('menu_management') && (
                                <NavLink to="/dashboard/menu" className={navLinkClass}>
                                    <Icon d={ICONS.menu} /> Menu
                                </NavLink>
                            )}
                            {isModuleEnabled('staff_management') && (
                                <NavLink to="/dashboard/staff" className={navLinkClass}>
                                    <Icon d={ICONS.staff} /> Staff
                                </NavLink>
                            )}
                            <NavLink to="/admin/tables" className={navLinkClass}>
                                <Icon d={ICONS.qr} /> QR Codes
                            </NavLink>
                            <NavLink to="/dashboard/profile" className={navLinkClass}>
                                <Icon d={ICONS.profile} /> Profile
                            </NavLink>
                            {ownerCanConfigure && (
                                <NavLink to="/dashboard/config" className={navLinkClass}>
                                    <Icon d={ICONS.configure} /> Configure
                                </NavLink>
                            )}
                        </>
                    )}

                    {/* CHEF nav */}
                    {role === 'CHEF' && isModuleEnabled('kitchen_module') && (
                        <>
                            <div className="sidebar-section-label">Kitchen</div>
                            <NavLink to="/dashboard/kitchen" className={navLinkClass}>
                                <Icon d={ICONS.kitchen} /> Kitchen
                            </NavLink>
                        </>
                    )}

                    {/* WAITER nav */}
                    {role === 'WAITER' && isModuleEnabled('waiter_module') && (
                        <>
                            <div className="sidebar-section-label">Service</div>
                            <NavLink to="/dashboard/waiter" className={navLinkClass}>
                                <Icon d={ICONS.waiter} /> Waiter
                            </NavLink>
                        </>
                    )}

                    {/* SUPER_ADMIN nav */}
                    {role === 'SUPER_ADMIN' && (
                        <>
                            <div className="sidebar-section-label">Admin</div>
                            <NavLink to="/superadmin" end className={navLinkClass}>
                                <Icon d={ICONS.sa_overview} /> Overview
                            </NavLink>
                            <NavLink to="/superadmin/restaurants" className={navLinkClass}>
                                <Icon d={ICONS.restaurants} /> Restaurants
                            </NavLink>

                            <div className="sidebar-section-label">View As</div>
                            <NavLink to="/dashboard" end className={navLinkClass}>
                                <Icon d={ICONS.overview} /> Analytics
                            </NavLink>
                            <NavLink to="/dashboard/orders" className={navLinkClass}>
                                <Icon d={ICONS.orders} /> Orders
                            </NavLink>
                            <NavLink to="/dashboard/menu" className={navLinkClass}>
                                <Icon d={ICONS.menu} /> Menu
                            </NavLink>
                            <NavLink to="/dashboard/staff" className={navLinkClass}>
                                <Icon d={ICONS.staff} /> Staff
                            </NavLink>
                            <NavLink to="/admin/tables" className={navLinkClass}>
                                <Icon d={ICONS.qr} /> QR Codes
                            </NavLink>
                            <NavLink to="/dashboard/profile" className={navLinkClass}>
                                <Icon d={ICONS.profile} /> Profile
                            </NavLink>
                            <NavLink to="/dashboard/config" className={navLinkClass}>
                                <Icon d={ICONS.configure} /> Configure
                            </NavLink>
                        </>
                    )}
                </nav>

                {/* Footer */}
                <div className="sidebar-footer">
                    <button
                        onClick={toggleDark}
                        className="sidebar-item"
                        title={isDark ? 'Light mode' : 'Dark mode'}
                    >
                        <Icon d={isDark ? ICONS.sun : ICONS.moon} />
                        {isDark ? 'Light mode' : 'Dark mode'}
                    </button>
                    <button onClick={handleLogout} className="sidebar-item" style={{ color: 'rgba(239,68,68,0.85)' }}>
                        <Icon d={ICONS.logout} />
                        Logout
                    </button>
                </div>
            </aside>
        </>
    )
}
