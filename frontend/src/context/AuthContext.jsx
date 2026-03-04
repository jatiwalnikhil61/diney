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
        })
    }, [])

    const setSelectedRestaurant = useCallback((id, name) => {
        setAuth(prev => ({ ...prev, selectedRestaurantId: id, restaurantName: name }))
    }, [])

    const isAuthenticated = !!auth.token

    // The effective restaurant_id for API calls
    const effectiveRestaurantId = auth.selectedRestaurantId || auth.restaurantId

    return (
        <AuthContext.Provider value={{
            ...auth,
            isAuthenticated,
            effectiveRestaurantId,
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
