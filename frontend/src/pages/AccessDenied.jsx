import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function getHomePath(role) {
    switch (role) {
        case 'CHEF': return '/dashboard/kitchen'
        case 'WAITER': return '/dashboard/waiter'
        default: return '/dashboard'
    }
}

export default function AccessDenied() {
    const navigate = useNavigate()
    const { role } = useAuth()

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center px-4">
            <p className="text-5xl mb-4">🚫</p>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-sm text-gray-500 mb-6">You don't have permission to view this page.</p>
            <button
                onClick={() => navigate(getHomePath(role))}
                className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 cursor-pointer"
            >
                Go to my dashboard
            </button>
        </div>
    )
}
