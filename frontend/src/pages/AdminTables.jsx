import { useState, useEffect, useRef, createRef } from 'react'
import toast from 'react-hot-toast'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const BASE_URL = import.meta.env.VITE_FRONTEND_URL || window.location.origin

export default function AdminTables() {
    const [tables, setTables] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [newTableNumber, setNewTableNumber] = useState('')
    const [adding, setAdding] = useState(false)
    const [modalError, setModalError] = useState('')
    const [deleteConfirmId, setDeleteConfirmId] = useState(null)
    const [deleting, setDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState('')
    const canvasRefs = useRef({})
    const { effectiveRestaurantId } = useAuth()
    const { isDark } = useTheme()

    const fetchTables = async () => {
        try {
            setLoading(true)
            const res = await api.get('/api/tables', { params: { restaurant_id: effectiveRestaurantId } })
            setTables(res.data)
            // Preserve existing refs (already attached to rendered canvases), only create new ones
            const refs = {}
            res.data.forEach(t => { refs[t.id] = canvasRefs.current[t.id] || createRef() })
            canvasRefs.current = refs
        } catch {
            setError('Failed to load tables')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchTables() }, [])

    const getQrUrl = (qrToken) => `${BASE_URL}/menu/${qrToken}`

    const downloadPng = (table) => {
        const canvas = canvasRefs.current[table.id]?.current
        if (!canvas) return
        const url = canvas.toDataURL('image/png')
        const a = document.createElement('a')
        a.href = url
        a.download = `diney-${table.table_number}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
    }

    const printQr = (table) => {
        const qrUrl = getQrUrl(table.qr_token)
        const win = window.open('', '_blank', 'width=400,height=600')
        win.document.write(`
      <!DOCTYPE html>
      <html>
      <head><title>QR - ${table.table_number}</title>
      <style>
        body { font-family: -apple-system, sans-serif; text-align: center; padding: 40px; }
        h1 { font-size: 48px; margin-bottom: 20px; }
        p { color: #666; font-size: 18px; margin-top: 16px; }
        .brand { color: #999; font-size: 14px; margin-top: 24px; }
      </style></head>
      <body>
        <h1>${table.table_number}</h1>
        <div id="qr"></div>
        <p>Scan to order</p>
        <p class="brand">Diney</p>
        <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></` + `script>
        <script>
          QRCode.toCanvas(document.createElement('canvas'), '${qrUrl}', { width: 300 }, function(err, canvas) {
            if (!err) document.getElementById('qr').appendChild(canvas);
            setTimeout(function() { window.print(); }, 500);
          });
        </` + `script>
      </body>
      </html>
    `)
        win.document.close()
    }

    const deleteTable = async (tableId) => {
        setDeleting(true)
        setDeleteError('')
        try {
            await api.delete(`/api/tables/${tableId}`)
            toast.success('Table deleted')
            setDeleteConfirmId(null)
            fetchTables()
        } catch (err) {
            setDeleteError(err.response?.data?.detail || 'Failed to delete table')
        } finally {
            setDeleting(false)
        }
    }

    const addTable = async () => {
        if (!newTableNumber.trim()) {
            setModalError('Please enter a table number')
            return
        }
        setAdding(true)
        setModalError('')
        try {
            await api.post('/api/tables', {
                restaurant_id: effectiveRestaurantId,
                table_number: newTableNumber.trim(),
            })
            toast.success('Table added!')
            setModalOpen(false)
            setNewTableNumber('')
            fetchTables()
        } catch (err) {
            setModalError(err.response?.data?.detail || 'Failed to add table')
        } finally {
            setAdding(false)
        }
    }

    return (
        <div>
            <div className="page-header-bar">
                <div>
                    <h1 className="page-title">QR Codes</h1>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Print and place on each table</p>
                </div>
                <button onClick={() => setModalOpen(true)} className="btn btn-primary">
                    + Add Table
                </button>
            </div>

            <div className="page-content">
                {loading && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} className="card animate-pulse" style={{ padding: 24 }}>
                                <div style={{ height: 20, background: 'var(--stone-200)', borderRadius: 4, width: 60, marginBottom: 16 }} />
                                <div style={{ height: 200, background: 'var(--stone-200)', borderRadius: 8, marginBottom: 12 }} />
                                <div style={{ height: 12, background: 'var(--stone-200)', borderRadius: 4, marginBottom: 16 }} />
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <div style={{ height: 36, background: 'var(--stone-200)', borderRadius: 6, flex: 1 }} />
                                    <div style={{ height: 36, background: 'var(--stone-200)', borderRadius: 6, flex: 1 }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {error && !loading && (
                    <div style={{ textAlign: 'center', padding: '48px 0' }}>
                        <p style={{ color: '#DC2626', marginBottom: 8 }}>{error}</p>
                        <button onClick={fetchTables} className="btn btn-ghost btn-sm">Try again</button>
                    </div>
                )}

                {!loading && !error && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                        {tables.map(table => (
                            <div key={table.id} className="card" style={{
                                padding: 24, opacity: table.is_active ? 1 : 0.6,
                                borderColor: table.is_active ? (isDark ? '#86EFAC' : '#34D399') : 'var(--border-light)',
                                borderWidth: 2,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {table.table_number}
                                    </h2>
                                    <span className={table.is_active ? 'badge badge-active' : 'badge badge-inactive'}>
                                        {table.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                                    <QRCodeSVG value={getQrUrl(table.qr_token)} size={200} level="M" includeMargin />
                                </div>

                                <div style={{ display: 'none' }}>
                                    <QRCodeCanvas ref={canvasRefs.current[table.id]} value={getQrUrl(table.qr_token)} size={400} level="M" includeMargin />
                                </div>

                                <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 16 }}>
                                    {getQrUrl(table.qr_token)}
                                </p>

                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={() => downloadPng(table)} className="btn btn-secondary" style={{ flex: 1 }}>Download</button>
                                    <button onClick={() => printQr(table)} className="btn btn-secondary" style={{ flex: 1 }}>Print</button>
                                    <button onClick={() => { setDeleteConfirmId(table.id); setDeleteError('') }} className="btn btn-ghost btn-sm" style={{ color: '#DC2626', padding: '0 10px' }} title="Delete table">🗑</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {deleteConfirmId && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => { setDeleteConfirmId(null); setDeleteError('') }} />
                    <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 380, padding: 24, borderRadius: 14, boxShadow: 'var(--shadow-xl)' }}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Delete Table?</h2>
                        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>
                            This will permanently delete the table and its QR code. Tables with active orders cannot be deleted.
                        </p>
                        {deleteError && <p style={{ fontSize: 13, color: '#DC2626', marginBottom: 12 }}>{deleteError}</p>}
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => { setDeleteConfirmId(null); setDeleteError('') }} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                            <button onClick={() => deleteTable(deleteConfirmId)} disabled={deleting} className="btn btn-primary" style={{ flex: 1, background: '#DC2626', borderColor: '#DC2626' }}>
                                {deleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setModalOpen(false)} />
                    <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 400, padding: 24, borderRadius: 14, boxShadow: 'var(--shadow-xl)' }}>
                        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Add Table</h2>
                        <input type="text" value={newTableNumber} onChange={e => setNewTableNumber(e.target.value)}
                            placeholder="e.g. T4, Rooftop 1, Bar Seat 3"
                            className="form-input" style={{ marginBottom: 8 }}
                            autoFocus onKeyDown={e => e.key === 'Enter' && addTable()} />
                        {modalError && <p style={{ fontSize: 12, color: '#DC2626', marginBottom: 8 }}>{modalError}</p>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                            <button onClick={() => { setModalOpen(false); setModalError(''); setNewTableNumber('') }}
                                className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                            <button onClick={addTable} disabled={adding} className="btn btn-primary" style={{ flex: 1 }}>
                                {adding ? 'Adding...' : 'Add Table'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
