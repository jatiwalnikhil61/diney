import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'
import api from '../services/api'

export default function DashboardNavbar() {
    const location = useLocation()
    const navigate = useNavigate()
    const { role, canAccessKitchen, canAccessWaiter, logout, restaurantName, setSelectedRestaurant, effectiveRestaurantId } = useAuth()
    const [restaurants, setRestaurants] = useState([])
    const [logoUrl, setLogoUrl] = useState(null)
    const [menuOpen, setMenuOpen] = useState(false)

    // Super admin: fetch restaurant list
    useEffect(() => {
        if (role !== 'SUPER_ADMIN') return
        api.get('/api/restaurants').then(res => {
            setRestaurants(res.data)
            if (!effectiveRestaurantId && res.data.length > 0) {
                setSelectedRestaurant(res.data[0].id, res.data[0].name)
            }
        }).catch(() => { })
    }, [role])

    // Fetch restaurant logo
    useEffect(() => {
        if (!effectiveRestaurantId) return
        api.get('/api/restaurants/profile/me', { params: { restaurant_id: effectiveRestaurantId } })
            .then(res => setLogoUrl(res.data.logo_url))
            .catch(() => { })
    }, [effectiveRestaurantId])

    // Close mobile menu on route change
    useEffect(() => { setMenuOpen(false) }, [location.pathname])

    const navItems = []

    if (role === 'OWNER') {
        navItems.push({ label: 'Overview', path: '/dashboard' })
        navItems.push({ label: 'Orders', path: '/dashboard/orders' })
    }

    if (role === 'CHEF' || (role === 'OWNER' && canAccessKitchen)) {
        navItems.push({ label: 'Kitchen', path: '/dashboard/kitchen' })
    }

    if (role === 'WAITER' || (role === 'OWNER' && canAccessWaiter)) {
        navItems.push({ label: 'Waiter', path: '/dashboard/waiter' })
    }

    if (role === 'OWNER') {
        navItems.push({ label: 'Menu', path: '/dashboard/menu' })
        navItems.push({ label: 'Staff', path: '/dashboard/staff' })
        navItems.push({ label: 'QR Codes', path: '/admin/tables' })
        navItems.push({ label: 'Profile', path: '/dashboard/profile' })
    }

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    return (
        <nav className="bg-white border-b border-gray-200 px-4 md:px-6 py-3">
            <div className="flex items-center justify-between">
                {/* Logo + restaurant name */}
                <div className="flex items-center gap-3">
                    <Link to="/dashboard" className="flex items-center gap-2">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                            <span className="text-lg font-bold text-gray-900 tracking-tight">Diney</span>
                        )}
                    </Link>
                    {restaurantName && (
                        <span className="text-xs text-gray-400 hidden sm:inline">{restaurantName}</span>
                    )}
                </div>

                {/* Desktop nav */}
                <div className="hidden md:flex items-center gap-1">
                    {role === 'SUPER_ADMIN' && restaurants.length > 0 && (
                        <select
                            value={effectiveRestaurantId || ''}
                            onChange={(e) => {
                                const r = restaurants.find(r => r.id === e.target.value)
                                if (r) setSelectedRestaurant(r.id, r.name)
                            }}
                            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 mr-2 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
                        >
                            <option value="" disabled>Select restaurant</option>
                            {restaurants.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    )}
                    {navItems.map(item => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${location.pathname === item.path
                                ? 'bg-gray-900 text-white'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`}
                        >
                            {item.label}
                        </Link>
                    ))}
                    <ThemeToggle className="ml-1" />
                    <button
                        onClick={handleLogout}
                        className="ml-1 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                        Logout
                    </button>
                </div>

                {/* Mobile hamburger */}
                <button
                    onClick={() => setMenuOpen(o => !o)}
                    className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                    aria-label="Toggle menu"
                >
                    {menuOpen ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    )}
                </button>
            </div>

            {/* Mobile menu dropdown */}
            {menuOpen && (
                <div className="md:hidden mt-3 pb-2 border-t border-gray-100 pt-3 space-y-1">
                    {role === 'SUPER_ADMIN' && restaurants.length > 0 && (
                        <select
                            value={effectiveRestaurantId || ''}
                            onChange={(e) => {
                                const r = restaurants.find(r => r.id === e.target.value)
                                if (r) setSelectedRestaurant(r.id, r.name)
                            }}
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
                        >
                            <option value="" disabled>Select restaurant</option>
                            {restaurants.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    )}
                    {navItems.map(item => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${location.pathname === item.path
                                ? 'bg-gray-900 text-white'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`}
                        >
                            {item.label}
                        </Link>
                    ))}
                    <ThemeToggle style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', borderRadius: 8 }} />
                    <button
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                        Logout
                    </button>
                </div>
            )}
        </nav>
    )
}
