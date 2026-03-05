import { createContext, useContext, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [auth, setAuth] = useState({
        token: null,
        role: null,
        email: null,
        restaurantId: null,
        restaurantName: null,
        canAccessKitchen: false,
        canAccessWaiter: false,
        selectedRestaurantId: null,
        modules: null,           // null = full access (SUPER_ADMIN)
        ownerCanConfigure: false,
    })

    const login = useCallback((data) => {
        setAuth({
            token: data.access_token,
            role: data.role,
            email: data.email,
            restaurantId: data.restaurant_id,
            restaurantName: data.restaurant_name,
            canAccessKitchen: data.can_access_kitchen,
            canAccessWaiter: data.can_access_waiter,
            selectedRestaurantId: data.restaurant_id,
            modules: data.modules || null,
            ownerCanConfigure: data.owner_can_configure || false,
        })
    }, [])

    const logout = useCallback(() => {
        setAuth({
            token: null,
            role: null,
            email: null,
            restaurantId: null,
            restaurantName: null,
            canAccessKitchen: false,
            canAccessWaiter: false,
            selectedRestaurantId: null,
            modules: null,
            ownerCanConfigure: false,
        })
    }, [])

    const setSelectedRestaurant = useCallback((id, name) => {
        setAuth(prev => ({ ...prev, selectedRestaurantId: id, restaurantName: name }))
    }, [])

    const isAuthenticated = !!auth.token

    // Module access check — SUPER_ADMIN (modules=null) always has access
    const isModuleEnabled = useCallback((moduleName) => {
        if (!auth.modules) return true  // null means full access (SUPER_ADMIN)
        return !!auth.modules[moduleName]
    }, [auth.modules])

    // Refresh modules after config change (re-fetch from API)
    const updateModules = useCallback((newModules) => {
        setAuth(prev => ({ ...prev, modules: newModules }))
    }, [])

    // The effective restaurant_id for API calls
    const effectiveRestaurantId = auth.selectedRestaurantId || auth.restaurantId

    return (
        <AuthContext.Provider value={{
            ...auth,
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
