import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const CustomerAuthContext = createContext(null)

export function CustomerAuthProvider({ children }) {
    const [customer, setCustomer] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        api.get('/api/customer/me')
            .then(res => setCustomer(res.data.customer))
            .catch(() => setCustomer(null))
            .finally(() => setLoading(false))
    }, [])

    const logout = async () => {
        await api.post('/api/customer/logout').catch(() => {})
        setCustomer(null)
    }

    return (
        <CustomerAuthContext.Provider value={{ customer, loading, setCustomer, logout }}>
            {children}
        </CustomerAuthContext.Provider>
    )
}

export function useCustomerAuth() {
    return useContext(CustomerAuthContext)
}
