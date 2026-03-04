import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'

const LOADING_MESSAGES = [
    'Reading your menu...',
    'Identifying dishes...',
    'Organizing categories...',
    'Almost done...',
]

export default function MenuImportModal({ onClose, effectiveRestaurantId, onImportComplete }) {
    const [step, setStep] = useState(1) // 1=Upload, 2=Review, 3=Success

    // Step 1 state
    const [file, setFile] = useState(null)
    const [preview, setPreview] = useState(null)
    const [extracting, setExtracting] = useState(false)
    const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)
    const [uploadError, setUploadError] = useState(null)
    const fileRef = useRef(null)

    // Step 2 state
    const [items, setItems] = useState([])
    const [warning, setWarning] = useState(null)
    const [fallbackUsed, setFallbackUsed] = useState(false)
    const [importing, setImporting] = useState(false)

    // Step 3 state
    const [result, setResult] = useState(null)

    // Cycling loading messages
    useEffect(() => {
        if (!extracting) return
        const timer = setInterval(() => {
            setLoadingMsgIdx(i => (i + 1) % LOADING_MESSAGES.length)
        }, 2000)
        return () => clearInterval(timer)
    }, [extracting])

    // ─── File handling ────────────────────────────────
    const handleFileSelect = (e) => {
        const f = e.target.files?.[0]
        if (!f) return
        setUploadError(null)

        const allowed = ['image/jpeg', 'image/png', 'image/webp']
        if (!allowed.includes(f.type)) {
            setUploadError('Please upload a JPG, PNG or WEBP image.')
            return
        }
        if (f.size > 10 * 1024 * 1024) {
            setUploadError('This image is too large. Please use an image under 10MB.')
            return
        }

        setFile(f)
        setPreview(URL.createObjectURL(f))
    }

    // ─── Extract ──────────────────────────────────────
    const handleExtract = async () => {
        if (!file) return
        setExtracting(true)
        setLoadingMsgIdx(0)
        setUploadError(null)

        try {
            const fd = new FormData()
            fd.append('file', file)
            const res = await api.post('/api/menu/ingest/extract', fd)

            setItems(
                (res.data.items || []).map((item, i) => ({
                    ...item,
                    include: true,
                    _id: i,
                }))
            )
            setWarning(res.data.warning)
            setFallbackUsed(res.data.fallback_used)
            setStep(2)
        } catch (err) {
            setUploadError(err.response?.data?.detail || 'Something went wrong. Please try again.')
        } finally {
            setExtracting(false)
        }
    }

    // ─── Add empty row ────────────────────────────────
    const addRow = () => {
        setItems(prev => [
            ...prev,
            {
                name: '',
                description: null,
                price: null,
                category: 'Uncategorized',
                is_veg: true,
                include: true,
                _id: Date.now(),
            },
        ])
    }

    // ─── Update item field ────────────────────────────
    const updateItem = (id, field, value) => {
        setItems(prev =>
            prev.map(item =>
                item._id === id ? { ...item, [field]: value } : item
            )
        )
    }

    // ─── Toggle all ───────────────────────────────────
    const allSelected = items.length > 0 && items.every(i => i.include)
    const toggleAll = () => {
        const newVal = !allSelected
        setItems(prev => prev.map(i => ({ ...i, include: newVal })))
    }
    const selectedCount = items.filter(i => i.include).length

    // ─── Confirm import ───────────────────────────────
    const handleConfirm = async () => {
        const included = items.filter(i => i.include)
        if (included.length === 0) {
            toast.error('No items selected')
            return
        }

        // Validate names
        const emptyNames = included.filter(i => !i.name.trim())
        if (emptyNames.length > 0) {
            toast.error('Some selected items have no name')
            return
        }

        setImporting(true)
        try {
            const res = await api.post(
                `/api/menu/ingest/confirm?restaurant_id=${effectiveRestaurantId}`,
                {
                    items: items.map(i => ({
                        name: i.name,
                        description: i.description || null,
                        price: i.price !== null && i.price !== '' ? Number(i.price) : null,
                        category: i.category || 'Uncategorized',
                        is_veg: i.is_veg ?? null,
                        include: i.include,
                    })),
                }
            )
            const nullPriceCount = included.filter(i => i.price === null || i.price === '' || i.price === undefined).length
            setResult({ ...res.data, nullPriceCount })
            setStep(3)
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Import failed')
        } finally {
            setImporting(false)
        }
    }

    // ─── Group by category ────────────────────────────
    const grouped = {}
    items.forEach(item => {
        const cat = item.category || 'Uncategorized'
        if (!grouped[cat]) grouped[cat] = []
        grouped[cat].push(item)
    })

    // ─── Existing category names for datalist ─────────
    const categoryNames = [...new Set(items.map(i => i.category || 'Uncategorized'))]

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={step === 2 ? undefined : onClose} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                {/* ─── STEP 1: Upload ──────────────────── */}
                {step === 1 && !extracting && (
                    <div className="p-6 overflow-y-auto">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold text-gray-900">Import from Photo</h2>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl cursor-pointer">✕</button>
                        </div>

                        {/* Upload area */}
                        {!preview ? (
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                className="w-full h-56 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors cursor-pointer"
                            >
                                <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="text-sm font-medium">Drop your menu photo here</span>
                                <span className="text-xs mt-1">or click to browse</span>
                                <span className="text-xs text-gray-300 mt-2">JPG, PNG, WEBP up to 10MB</span>
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <img src={preview} alt="Menu preview" className="w-full max-h-[300px] object-contain rounded-lg border border-gray-200" />
                                <div className="flex items-center justify-between text-sm text-gray-500">
                                    <span>{file.name} ({(file.size / 1024 / 1024).toFixed(1)}MB)</span>
                                    <button onClick={() => { setFile(null); setPreview(null); fileRef.current.value = '' }} className="text-gray-500 hover:text-gray-800 cursor-pointer">Change Photo</button>
                                </div>
                            </div>
                        )}

                        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} className="hidden" />

                        {/* Error */}
                        {uploadError && (
                            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{uploadError}</div>
                        )}

                        {/* Tips */}
                        <div className="mt-5 space-y-1.5 text-xs text-gray-400">
                            <p>💡 Works best with flat, well-lit menus</p>
                            <p>💡 Make sure text is clearly readable</p>
                            <p>💡 Printed menus work better than handwritten ones</p>
                        </div>

                        {/* Action */}
                        <button
                            onClick={handleExtract}
                            disabled={!file}
                            className="w-full mt-5 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            Extract Menu Items →
                        </button>
                    </div>
                )}

                {/* ─── LOADING ─────────────────────────── */}
                {extracting && (
                    <div className="flex flex-col items-center justify-center py-20 px-6">
                        <svg className="animate-spin h-10 w-10 text-gray-400 mb-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <p className="text-sm text-gray-600 font-medium">{LOADING_MESSAGES[loadingMsgIdx]}</p>
                    </div>
                )}

                {/* ─── STEP 2: Review ──────────────────── */}
                {step === 2 && (
                    <>
                        <div className="p-6 pb-3 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Review Extracted Items</h2>
                                    <p className="text-xs text-gray-400 mt-0.5">{items.length} items found</p>
                                </div>
                                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl cursor-pointer">✕</button>
                            </div>

                            {fallbackUsed && !warning && (
                                <p className="text-xs text-gray-400 mt-2">Extracted using fallback AI provider</p>
                            )}
                            {warning && (
                                <div className="mt-2 p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                                    {warning}
                                </div>
                            )}

                            {/* Toolbar */}
                            <div className="flex items-center gap-4 mt-3">
                                <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={toggleAll}
                                        className="w-3.5 h-3.5 rounded border-gray-300 accent-gray-900"
                                    />
                                    {allSelected ? 'Deselect All' : 'Select All'}
                                </label>
                                <span className="text-xs text-gray-400">{selectedCount} of {items.length} selected</span>
                                <button
                                    onClick={addRow}
                                    className="ml-auto text-xs font-medium text-gray-600 hover:text-gray-900 cursor-pointer"
                                >
                                    ＋ Add Row
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="flex-1 overflow-y-auto px-6 py-3">
                            <datalist id="cat-suggestions">
                                {categoryNames.map(c => <option key={c} value={c} />)}
                            </datalist>

                            {Object.entries(grouped).map(([catName, catItems]) => (
                                <div key={catName} className="mb-4">
                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <span className="flex-1 border-t border-gray-200" />
                                        {catName} ({catItems.length})
                                        <span className="flex-1 border-t border-gray-200" />
                                    </div>

                                    <div className="space-y-1.5">
                                        {catItems.map(item => (
                                            <div
                                                key={item._id}
                                                className={`grid grid-cols-[28px_1fr_1.5fr_1.2fr_80px_40px] gap-2 items-center text-sm rounded-lg px-2 py-1.5 transition-opacity ${!item.include ? 'opacity-40 bg-gray-50' : 'bg-white border border-gray-100'}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={item.include}
                                                    onChange={() => updateItem(item._id, 'include', !item.include)}
                                                    className="w-3.5 h-3.5 rounded border-gray-300 accent-gray-900"
                                                />
                                                <input
                                                    value={item.category}
                                                    onChange={e => updateItem(item._id, 'category', e.target.value)}
                                                    list="cat-suggestions"
                                                    placeholder="Category"
                                                    className="px-1.5 py-1 border border-transparent hover:border-gray-200 focus:border-gray-300 rounded text-xs bg-transparent focus:outline-none focus:bg-white"
                                                />
                                                <input
                                                    value={item.name}
                                                    onChange={e => updateItem(item._id, 'name', e.target.value)}
                                                    placeholder="Dish name *"
                                                    className={`px-1.5 py-1 border rounded text-xs focus:outline-none focus:bg-white ${!item.name.trim() && item.include ? 'border-red-300 bg-red-50' : 'border-transparent hover:border-gray-200 focus:border-gray-300 bg-transparent'}`}
                                                />
                                                <input
                                                    value={item.description || ''}
                                                    onChange={e => updateItem(item._id, 'description', e.target.value || null)}
                                                    placeholder="Description"
                                                    className="px-1.5 py-1 border border-transparent hover:border-gray-200 focus:border-gray-300 rounded text-xs bg-transparent focus:outline-none focus:bg-white"
                                                />
                                                <input
                                                    type="number"
                                                    value={item.price ?? ''}
                                                    onChange={e => updateItem(item._id, 'price', e.target.value !== '' ? Number(e.target.value) : null)}
                                                    placeholder="₹ Price"
                                                    className="px-1.5 py-1 border border-transparent hover:border-gray-200 focus:border-gray-300 rounded text-xs bg-transparent focus:outline-none focus:bg-white w-full"
                                                />
                                                <label className="flex items-center justify-center cursor-pointer" title={item.is_veg ? 'Veg' : 'Non-Veg'}>
                                                    <input
                                                        type="checkbox"
                                                        checked={item.is_veg ?? true}
                                                        onChange={e => updateItem(item._id, 'is_veg', e.target.checked)}
                                                        className="w-3 h-3 rounded accent-green-600"
                                                    />
                                                    <span className="ml-1 text-xs">{item.is_veg ? '🟢' : '🔴'}</span>
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {items.length === 0 && (
                                <div className="text-center py-12 text-gray-400 text-sm">
                                    <p className="mb-2">No items detected.</p>
                                    <button onClick={addRow} className="text-gray-600 hover:text-gray-900 font-medium cursor-pointer">
                                        ＋ Add items manually
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Bottom actions */}
                        <div className="p-4 border-t border-gray-200 flex items-center gap-3">
                            <button
                                onClick={() => setStep(1)}
                                className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer"
                            >
                                ← Back
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={selectedCount === 0 || importing}
                                className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {importing ? 'Importing...' : `Import ${selectedCount} Items →`}
                            </button>
                        </div>
                    </>
                )}

                {/* ─── STEP 3: Success ─────────────────── */}
                {step === 3 && (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-1">Import Complete!</h2>
                        <p className="text-sm text-gray-500 mb-4">{result?.message}</p>

                        {result?.nullPriceCount > 0 && (
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 mb-4 max-w-sm">
                                ⚠️ {result.nullPriceCount} items were imported with ₹0 price. Remember to update their prices in the menu.
                            </div>
                        )}

                        <button
                            onClick={() => { onImportComplete?.(); onClose() }}
                            className="px-6 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 cursor-pointer"
                        >
                            View Menu
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
