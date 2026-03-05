export default function LoadingScreen() {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: 'var(--cream)',
        }}>
            <div style={{
                width: 56,
                height: 56,
                background: 'var(--saffron)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'spin 1s linear infinite',
            }}>
                <span style={{
                    color: '#fff',
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 700,
                    fontSize: 28,
                }}>D</span>
            </div>
        </div>
    )
}
