import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'

function getHomePath(role, modules) {
    // modules = null means SUPER_ADMIN (full access)
    const isOn = (mod) => !modules || modules[mod] !== false

    switch (role) {
        case 'CHEF':
            return isOn('kitchen_module') ? '/dashboard/kitchen' : '/dashboard/orders'
        case 'WAITER':
            return isOn('waiter_module') ? '/dashboard/waiter' : '/dashboard/orders'
        case 'SUPER_ADMIN':
            return '/superadmin'
        default: // OWNER — priority: dashboard → menu → staff → profile
            if (isOn('owner_dashboard')) return '/dashboard'
            if (isOn('menu_management')) return '/dashboard/menu'
            if (isOn('staff_management')) return '/dashboard/staff'
            return '/dashboard/profile'
    }
}

export default function Login() {
    const navigate = useNavigate()
    const { login, isAuthenticated, loading: authLoading, role, modules } = useAuth()
    const [step, setStep] = useState(1) // 1 = credentials, 2 = OTP
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [otpToken, setOtpToken] = useState('')
    const [otp, setOtp] = useState(['', '', '', '', '', ''])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [resendCountdown, setResendCountdown] = useState(0)
    const [sessionExpired, setSessionExpired] = useState(false)
    const otpRefs = useRef([])

    // Redirect if already logged in (wait for session restore first)
    useEffect(() => {
        if (!authLoading && isAuthenticated) navigate(getHomePath(role, modules), { replace: true })
    }, [authLoading, isAuthenticated])

    // Show session expired banner if redirected from 401
    useEffect(() => {
        if (sessionStorage.getItem('session_expired')) {
            setSessionExpired(true)
            sessionStorage.removeItem('session_expired')
        }
    }, [])

    // Resend countdown timer
    useEffect(() => {
        if (resendCountdown <= 0) return
        const t = setTimeout(() => setResendCountdown(c => c - 1), 1000)
        return () => clearTimeout(t)
    }, [resendCountdown])

    const handleLogin = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const res = await api.post('/api/auth/login', { email, password })
            setOtpToken(res.data.otp_token)
            setStep(2)
            setResendCountdown(30)
        } catch (err) {
            setError(err.response?.data?.detail || 'Login failed')
        } finally {
            setLoading(false)
        }
    }

    const handleOtpChange = (index, value) => {
        if (value.length > 1) {
            // Handle paste
            const digits = value.replace(/\D/g, '').slice(0, 6).split('')
            const newOtp = [...otp]
            digits.forEach((d, i) => {
                if (index + i < 6) newOtp[index + i] = d
            })
            setOtp(newOtp)
            const nextIndex = Math.min(index + digits.length, 5)
            otpRefs.current[nextIndex]?.focus()
            return
        }

        if (value && !/^\d$/.test(value)) return

        const newOtp = [...otp]
        newOtp[index] = value
        setOtp(newOtp)

        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus()
        }
    }

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus()
        }
    }

    const handleVerifyOtp = async (e) => {
        e.preventDefault()
        const code = otp.join('')
        if (code.length !== 6) {
            setError('Please enter all 6 digits')
            return
        }
        setError('')
        setLoading(true)
        try {
            const res = await api.post('/api/auth/verify-otp', { otp: code }, {
                headers: { Authorization: `Bearer ${otpToken}` },
            })
            login(res.data)
            toast.success('Welcome!')
            navigate(getHomePath(res.data.user.role, res.data.modules), { replace: true })
        } catch (err) {
            setError(err.response?.data?.detail || 'Verification failed')
            setOtp(['', '', '', '', '', ''])
            otpRefs.current[0]?.focus()
        } finally {
            setLoading(false)
        }
    }

    const handleResend = async () => {
        if (resendCountdown > 0) return
        try {
            await api.post('/api/auth/resend-otp', {}, {
                headers: { Authorization: `Bearer ${otpToken}` },
            })
            toast.success('OTP resent')
            setResendCountdown(30)
            setOtp(['', '', '', '', '', ''])
            otpRefs.current[0]?.focus()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to resend')
        }
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="card" style={{ width: '100%', maxWidth: 380, padding: 32, borderRadius: 16, boxShadow: 'var(--shadow-lg)' }}>
                {sessionExpired && (
                    <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#92400E', textAlign: 'center' }}>
                        Your session has expired. Please log in again.
                    </div>
                )}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Diney
                    </h1>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Staff Login</p>
                </div>

                {step === 1 && (
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Email</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                placeholder="you@restaurant.com" required autoFocus className="form-input" />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Password</label>
                            <div style={{ position: 'relative' }}>
                                <input type={showPassword ? 'text' : 'password'} value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••" required className="form-input" style={{ paddingRight: 52 }} />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    className="btn btn-ghost btn-sm"
                                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 11, padding: '2px 8px' }}>
                                    {showPassword ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </div>
                        {error && <p style={{ fontSize: 12, color: '#DC2626' }}>{error}</p>}
                        <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 4 }}>
                            {loading ? 'Signing in...' : 'Continue →'}
                        </button>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Check your phone</p>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Enter the 6-digit OTP sent to your registered phone</p>
                            {DEV_MODE && (
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, background: 'var(--stone-100)', borderRadius: 6, padding: '6px 12px' }}>
                                    Dev mode: check your terminal for the OTP
                                </p>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                            {otp.map((digit, i) => (
                                <input key={i} ref={el => otpRefs.current[i] = el}
                                    type="text" inputMode="numeric" maxLength={6} value={digit}
                                    onChange={e => handleOtpChange(i, e.target.value)}
                                    onKeyDown={e => handleOtpKeyDown(i, e)}
                                    autoFocus={i === 0}
                                    style={{
                                        width: 44, height: 48, border: '1px solid var(--border)', borderRadius: 8,
                                        textAlign: 'center', fontSize: 18, fontWeight: 700,
                                        outline: 'none', color: 'var(--text-primary)', background: 'var(--white)',
                                    }}
                                    onFocus={e => { e.target.style.borderColor = 'var(--saffron)'; e.target.style.boxShadow = '0 0 0 3px var(--saffron-ring)' }}
                                    onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
                                />
                            ))}
                        </div>

                        {error && <p style={{ fontSize: 12, color: '#DC2626', textAlign: 'center' }}>{error}</p>}

                        <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                            {loading ? 'Verifying...' : 'Verify OTP'}
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                            <button type="button" onClick={() => { setStep(1); setError(''); setOtp(['', '', '', '', '', '']) }}
                                className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }}>
                                ← Back
                            </button>
                            {resendCountdown > 0 ? (
                                <span style={{ color: 'var(--text-muted)' }}>Resend in {resendCountdown}s</span>
                            ) : (
                                <button type="button" onClick={handleResend} className="btn btn-ghost btn-sm"
                                    style={{ padding: '2px 6px', color: 'var(--saffron-dark)', fontWeight: 600 }}>
                                    Resend OTP
                                </button>
                            )}
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
