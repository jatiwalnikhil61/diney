import axios from 'axios'

// API calls use relative URLs so they go through the Vite proxy in dev
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
})

// ─── Auth interceptor setup ──────────────────────────────
// Called by App.jsx after AuthContext is available
let _authRef = null
export function setupInterceptors(authRef) {
    _authRef = authRef
}

// Request interceptor: attach Bearer token
api.interceptors.request.use((config) => {
    if (_authRef?.token) {
        config.headers.Authorization = `Bearer ${_authRef.token}`
    }
    return config
})

// Response interceptor: on 401 → logout → redirect
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401 && _authRef?.logout) {
            // Don't logout for auth endpoints (login, verify-otp)
            const url = err.config?.url || ''
            if (!url.includes('/api/auth/')) {
                _authRef.logout()
                window.location.href = '/login'
            }
        }
        return Promise.reject(err)
    }
)

export default api
