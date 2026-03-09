import axios from 'axios'

// API calls use relative URLs so they go through the Vite proxy in dev
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    withCredentials: true,
})

// ─── Auth interceptor setup ──────────────────────────────
// Called by App.jsx after AuthContext is available
let _logoutFn = null
export function setupInterceptors(logoutFn) {
    _logoutFn = logoutFn
}

// Response interceptor: on 401 → logout → redirect
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401 && _logoutFn) {
            // Don't logout for auth or customer endpoints
            const url = err.config?.url || ''
            if (!url.includes('/api/auth/') && !url.includes('/api/customer/')) {
                _logoutFn()
                sessionStorage.setItem('session_expired', '1')
                window.location.href = '/login'
            }
        }
        return Promise.reject(err)
    }
)

export default api
