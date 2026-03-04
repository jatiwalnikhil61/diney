import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AccessDenied from '../pages/AccessDenied'

export default function PrivateRoute({ children, role, requireKitchenAccess, requireWaiterAccess }) {
    const auth = useAuth()

    // Not logged in → redirect to login
    if (!auth.isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    // Role check
    if (role) {
        const allowed = Array.isArray(role) ? role : [role]
        if (!allowed.includes(auth.role)) {
            return <AccessDenied />
        }
    }

    // Kitchen access check
    if (requireKitchenAccess) {
        const hasAccess = auth.role === 'CHEF' ||
            auth.role === 'SUPER_ADMIN' ||
            (auth.role === 'OWNER' && auth.canAccessKitchen)
        if (!hasAccess) return <AccessDenied />
    }

    // Waiter access check
    if (requireWaiterAccess) {
        const hasAccess = auth.role === 'WAITER' ||
            auth.role === 'SUPER_ADMIN' ||
            (auth.role === 'OWNER' && auth.canAccessWaiter)
        if (!hasAccess) return <AccessDenied />
    }

    return children
}
