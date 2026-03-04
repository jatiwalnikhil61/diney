import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function SuperAdminNavbar() {
    const location = useLocation()
    const navigate = useNavigate()
    const { logout } = useAuth()

    const navItems = [
        { label: 'Overview', path: '/superadmin' },
        { label: 'Restaurants', path: '/superadmin/restaurants' },
    ]

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    const isActive = (path) => {
        if (path === '/superadmin') return location.pathname === '/superadmin'
        return location.pathname.startsWith(path)
    }

    return (
        <nav className="bg-gray-900 px-4 md:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-6">
                <Link to="/superadmin" className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white tracking-tight">Diney</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500 text-white font-medium">Admin</span>
                </Link>
                <div className="flex items-center gap-1">
                    {navItems.map(item => (
                        <Link key={item.path} to={item.path}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive(item.path)
                                ? 'bg-gray-700 text-white'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                }`}>
                            {item.label}
                        </Link>
                    ))}
                </div>
            </div>
            <button onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors cursor-pointer">
                Logout
            </button>
        </nav>
    )
}
