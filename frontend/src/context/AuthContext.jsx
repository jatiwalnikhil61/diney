import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const AuthContext = createContext(null)

const EMPTY = {
    role: null,
    email: null,
    restaurantId: null,
    restaurantName: null,
    canAccessKitchen: false,
    canAccessWaiter: false,
    selectedRestaurantId: null,
    modules: null,
    ownerCanConfigure: false,
}

function mapResponse(data) {
    return {
        role: data.user.role,
        email: data.user.email,
        restaurantId: data.user.restaurant_id,
        restaurantName: data.user.restaurant_name,
        canAccessKitchen: data.user.can_access_kitchen,
        canAccessWaiter: data.user.can_access_waiter,
        selectedRestaurantId: data.user.restaurant_id,
        modules: data.modules || null,
        ownerCanConfigure: data.user.owner_can_configure || false,
    }
}

export function AuthProvider({ children }) {
    const [auth, setAuth] = useState(EMPTY)
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    // Restore session from cookie on mount
    useEffect(() => {
        api.get('/api/auth/me')
            .then(res => setAuth(mapResponse(res.data)))
            .catch(() => setAuth(EMPTY))
            .finally(() => setLoading(false))
    }, [])

    const login = useCallback((data) => {
        setAuth(mapResponse(data))
    }, [])

    const logout = useCallback(async () => {
        try { await api.post('/api/auth/logout') } catch {}
        setAuth(EMPTY)
        navigate('/login')
    }, [navigate])

    const setSelectedRestaurant = useCallback((id, name) => {
        setAuth(prev => ({ ...prev, selectedRestaurantId: id, restaurantName: name }))
    }, [])

    const isAuthenticated = !!auth.role

    // Module access check — SUPER_ADMIN (modules=null) always has access
    const isModuleEnabled = useCallback((moduleName) => {
        if (!auth.modules) return true
        return !!auth.modules[moduleName]
    }, [auth.modules])

    const updateModules = useCallback((newModules) => {
        setAuth(prev => ({ ...prev, modules: newModules }))
    }, [])

    const effectiveRestaurantId = auth.selectedRestaurantId || auth.restaurantId

    return (
        <AuthContext.Provider value={{
            ...auth,
            loading,
            isAuthenticated,
            effectiveRestaurantId,
            isModuleEnabled,
            updateModules,
            login,
            logout,
            setSelectedRestaurant,
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}
