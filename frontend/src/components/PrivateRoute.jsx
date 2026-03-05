import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AccessDenied from '../pages/AccessDenied'
import ModuleDisabled from '../pages/ModuleDisabled'
import LoadingScreen from './LoadingScreen'

export default function PrivateRoute({ children, role, requireKitchenAccess, requireWaiterAccess, module }) {
    const auth = useAuth()

    // Wait for session restore before deciding
    if (auth.loading) return <LoadingScreen />

    // Not logged in → redirect to login
    if (!auth.isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    // Role check — SUPER_ADMIN bypasses all role restrictions
    if (role && auth.role !== 'SUPER_ADMIN') {
        const allowed = Array.isArray(role) ? role : [role]
        if (!allowed.includes(auth.role)) {
            return <AccessDenied />
        }
    }

    // Module check — if a module is specified and it's disabled for this restaurant
    if (module && !auth.isModuleEnabled(module)) {
        return <ModuleDisabled moduleName={module} />
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
