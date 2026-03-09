import { useState, useRef, useEffect } from 'react'
import api from '../services/api'
import { useCustomerAuth } from '../context/CustomerAuthContext'

export default function CustomerVerification({ restaurantId, restaurantName }) {
    const { setCustomer } = useCustomerAuth()
    const [step, setStep] = useState(1) // 1=phone, 2=otp, 3=name (new customers only, AFTER OTP verified)
    const [phone, setPhone] = useState('')
    const [otp, setOtp] = useState(['', '', '', '', '', ''])
    const [name, setName] = useState('')
    const [isNewCustomer, setIsNewCustomer] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [resendCountdown, setResendCountdown] = useState(0)
    const otpRefs = useRef([])
    const timerRef = useRef(null)

    useEffect(() => {
        return () => clearInterval(timerRef.current)
    }, [])

    const startResendTimer = () => {
        setResendCountdown(30)
        timerRef.current = setInterval(() => {
            setResendCountdown(prev => {
                if (prev <= 1) { clearInterval(timerRef.current); return 0 }
                return prev - 1
            })
        }, 1000)
    }

    // ── Step 1: request OTP ──────────────────────────────
    const handleRequestOtp = async (e) => {
        e.preventDefault()
        setError('')
        if (!phone.trim()) { setError('Please enter your phone number'); return }
        setLoading(true)
        try {
            const res = await api.post('/api/customer/request-otp', {
                phone: phone.trim(),
                restaurant_id: restaurantId,
            })
            setIsNewCustomer(res.data.is_new_customer)
            setStep(2)
            startResendTimer()
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to send OTP. Try again.')
        } finally {
            setLoading(false)
        }
    }

    // ── Step 2: verify OTP — always calls API first ──────
    const handleVerifyOtp = async (e) => {
        e.preventDefault()
        setError('')
        const otpStr = otp.join('')
        if (otpStr.length < 6) { setError('Enter the 6-digit code'); return }
        setLoading(true)
        try {
            const res = await api.post('/api/customer/verify-otp', {
                phone: phone.trim(),
                restaurant_id: restaurantId,
                otp: otpStr,
            })
            // OTP verified and cookie set for all customers
            setCustomer(res.data.customer)
            if (isNewCustomer) {
                // Go to name step (customer already authenticated, just need the name)
                setStep(3)
                setLoading(false)
                return
            }
            // Returning customers: done
        } catch (err) {
            const msg = err.response?.data?.detail || ''
            if (msg.toLowerCase().includes('expired')) {
                setError('Code expired. Please request a new one.')
            } else {
                setError('Incorrect code, please try again.')
            }
        } finally {
            setLoading(false)
        }
    }

    // ── Step 3: save name via update-name endpoint ───────
    const handleSubmitName = async (e) => {
        e.preventDefault()
        setError('')
        if (!name.trim()) { setError('Please enter your name'); return }
        setLoading(true)
        try {
            const res = await api.post('/api/customer/update-name', { name: name.trim() })
            setCustomer(res.data.customer)
        } catch (err) {
            setError(err.response?.data?.detail || 'Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // ── OTP digit input helpers ──────────────────────────
    const handleOtpChange = (i, val) => {
        if (!/^\d*$/.test(val)) return
        const next = [...otp]
        next[i] = val.slice(-1)
        setOtp(next)
        if (val && i < 5) otpRefs.current[i + 1]?.focus()
    }

    const handleOtpKeyDown = (i, e) => {
        if (e.key === 'Backspace' && !otp[i] && i > 0) {
            otpRefs.current[i - 1]?.focus()
        }
    }

    const handleResend = async () => {
        if (resendCountdown > 0) return
        setError('')
        setOtp(['', '', '', '', '', ''])
        setLoading(true)
        try {
            const res = await api.post('/api/customer/request-otp', {
                phone: phone.trim(),
                restaurant_id: restaurantId,
            })
            setIsNewCustomer(res.data.is_new_customer)
            startResendTimer()
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to resend.')
        } finally {
            setLoading(false)
        }
    }

    // ── Shared styles ────────────────────────────────────
    const cardStyle = {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: '#FAFAF9',
    }
    const innerStyle = {
        width: '100%',
        maxWidth: 400,
        background: '#fff',
        borderRadius: 20,
        padding: '36px 28px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    }
    const logoStyle = {
        width: 52,
        height: 52,
        borderRadius: 14,
        background: '#F59E0B',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 12px',
        fontFamily: 'Playfair Display, serif',
        fontSize: 28,
        fontWeight: 700,
        color: '#fff',
    }
    const titleStyle = {
        fontSize: 20,
        fontWeight: 700,
        color: '#111',
        textAlign: 'center',
        marginBottom: 6,
        fontFamily: 'Playfair Display, serif',
    }
    const subtitleStyle = {
        fontSize: 13,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 28,
        lineHeight: 1.5,
    }
    const inputStyle = {
        width: '100%',
        padding: '12px 14px',
        border: '1.5px solid #E5E7EB',
        borderRadius: 10,
        fontSize: 15,
        outline: 'none',
        boxSizing: 'border-box',
        marginBottom: 12,
        fontFamily: 'DM Sans, sans-serif',
        minHeight: 44,
    }
    const btnStyle = {
        width: '100%',
        padding: '13px',
        background: '#F59E0B',
        color: '#fff',
        border: 'none',
        borderRadius: 10,
        fontSize: 15,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'DM Sans, sans-serif',
        opacity: loading ? 0.7 : 1,
        minHeight: 44,
    }
    const backBtnStyle = {
        background: 'none',
        border: 'none',
        color: '#6B7280',
        cursor: 'pointer',
        padding: 0,
        fontSize: 13,
    }
    const errorStyle = {
        fontSize: 13,
        color: '#DC2626',
        textAlign: 'center',
        marginBottom: 10,
    }

    return (
        <div style={cardStyle}>
            <div style={innerStyle}>
                {/* Logo */}
                <div style={logoStyle}>D</div>
                <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginBottom: 20 }}>
                    {restaurantName}
                </p>

                {/* ── Step 1: Phone ── */}
                {step === 1 && (
                    <form onSubmit={handleRequestOtp}>
                        <h1 style={titleStyle}>Welcome!</h1>
                        <p style={subtitleStyle}>
                            Enter your phone number to view the menu and track your order.
                        </p>
                        {error && <p style={errorStyle}>{error}</p>}
                        <input
                            style={inputStyle}
                            type="tel"
                            inputMode="tel"
                            placeholder="+91 98765 43210"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            autoFocus
                        />
                        <button style={btnStyle} type="submit" disabled={loading}>
                            {loading ? 'Sending…' : 'Send OTP'}
                        </button>
                    </form>
                )}

                {/* ── Step 2: OTP ── */}
                {step === 2 && (
                    <form onSubmit={handleVerifyOtp}>
                        <h1 style={titleStyle}>Enter verification code</h1>
                        <p style={subtitleStyle}>We sent a 6-digit code to {phone}</p>
                        {error && <p style={errorStyle}>{error}</p>}

                        {/* OTP boxes */}
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
                            {otp.map((digit, i) => (
                                <input
                                    key={i}
                                    ref={el => otpRefs.current[i] = el}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={e => handleOtpChange(i, e.target.value)}
                                    onKeyDown={e => handleOtpKeyDown(i, e)}
                                    style={{
                                        width: 44,
                                        height: 52,
                                        textAlign: 'center',
                                        fontSize: 22,
                                        fontWeight: 700,
                                        border: '1.5px solid #E5E7EB',
                                        borderRadius: 10,
                                        outline: 'none',
                                        fontFamily: 'DM Sans, sans-serif',
                                    }}
                                    autoFocus={i === 0}
                                />
                            ))}
                        </div>

                        <button style={btnStyle} type="submit" disabled={loading}>
                            {loading ? 'Verifying…' : 'Verify'}
                        </button>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontSize: 13 }}>
                            <button
                                type="button"
                                onClick={() => { setStep(1); setError(''); setOtp(['', '', '', '', '', '']) }}
                                style={backBtnStyle}
                            >
                                ← Change number
                            </button>
                            <button
                                type="button"
                                onClick={handleResend}
                                disabled={resendCountdown > 0}
                                style={{
                                    background: 'none', border: 'none', cursor: resendCountdown > 0 ? 'default' : 'pointer',
                                    color: resendCountdown > 0 ? '#9CA3AF' : '#F59E0B',
                                    fontWeight: 600, padding: 0, fontSize: 13,
                                }}
                            >
                                {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend OTP'}
                            </button>
                        </div>
                    </form>
                )}

                {/* ── Step 3: Name (new customers only, OTP already verified) ── */}
                {step === 3 && (
                    <form onSubmit={handleSubmitName}>
                        <h1 style={titleStyle}>What's your name?</h1>
                        <p style={subtitleStyle}>So we can personalise your experience.</p>
                        {error && <p style={errorStyle}>{error}</p>}
                        <input
                            style={inputStyle}
                            type="text"
                            placeholder="Your name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            autoFocus
                        />
                        <button style={btnStyle} type="submit" disabled={loading}>
                            {loading ? 'Just a moment…' : "Let's go →"}
                        </button>
                        <div style={{ textAlign: 'center', marginTop: 12 }}>
                            <button
                                type="button"
                                onClick={() => { setStep(2); setError('') }}
                                style={backBtnStyle}
                            >
                                ← Back
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
