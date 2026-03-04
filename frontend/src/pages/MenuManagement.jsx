import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import MenuImportModal from '../components/MenuImportModal'

export default function MenuManagement() {
    const { effectiveRestaurantId } = useAuth()

    // ─── State ────────────────────────────────────────
    const [categories, setCategories] = useState([])
    const [items, setItems] = useState([])
    const [selectedCatId, setSelectedCatId] = useState(null)
    const [loadingCats, setLoadingCats] = useState(true)
    const [loadingItems, setLoadingItems] = useState(false)

    // Category inline editing
    const [editingCatId, setEditingCatId] = useState(null)
    const [editCatName, setEditCatName] = useState('')
    const [addingCat, setAddingCat] = useState(false)
    const [newCatName, setNewCatName] = useState('')
    const addCatRef = useRef(null)
    const editCatRef = useRef(null)

    // Item modal
    const [modalOpen, setModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [itemForm, setItemForm] = useState({
        name: '', description: '', price: '', preparation_time: 10,
        is_veg: true, is_available: true, photo_url: '', category_id: '',
    })
    const [formErrors, setFormErrors] = useState({})
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef(null)

    // Delete confirm
    const [deleteConfirm, setDeleteConfirm] = useState(null)

    // Import modal
    const [importModalOpen, setImportModalOpen] = useState(false)

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    // ─── Fetch ────────────────────────────────────────
    const fetchCategories = async () => {
        try {
            setLoadingCats(true)
            const res = await api.get('/api/menu/categories', {
                params: { restaurant_id: effectiveRestaurantId },
            })
            setCategories(res.data)
        } catch { toast.error('Failed to load categories') }
        finally { setLoadingCats(false) }
    }

    const fetchItems = async (catId) => {
        if (!catId) return
        try {
            setLoadingItems(true)
            const res = await api.get('/api/menu/items', {
                params: { restaurant_id: effectiveRestaurantId, category_id: catId },
            })
            setItems(res.data)
        } catch { toast.error('Failed to load items') }
        finally { setLoadingItems(false) }
    }

    useEffect(() => { if (effectiveRestaurantId) fetchCategories() }, [effectiveRestaurantId])
    useEffect(() => { fetchItems(selectedCatId) }, [selectedCatId])

    // ─── Category CRUD ────────────────────────────────
    const addCategory = async () => {
        if (!newCatName.trim()) return
        try {
            await api.post('/api/menu/categories', {
                restaurant_id: effectiveRestaurantId,
                name: newCatName.trim(),
                sort_order: categories.length,
            })
            setNewCatName('')
            setAddingCat(false)
            fetchCategories()
            toast.success('Category added')
        } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
    }

    const renameCategory = async (catId) => {
        if (!editCatName.trim()) { setEditingCatId(null); return }
        try {
            await api.put(`/api/menu/categories/${catId}`, { name: editCatName.trim() })
            setEditingCatId(null)
            fetchCategories()
        } catch (err) { toast.error(err.response?.data?.detail || 'Rename failed') }
    }

    const deleteCategory = async (catId) => {
        try {
            await api.delete(`/api/menu/categories/${catId}`)
            setDeleteConfirm(null)
            if (selectedCatId === catId) { setSelectedCatId(null); setItems([]) }
            fetchCategories()
            toast.success('Category deleted')
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Delete failed')
            setDeleteConfirm(null)
        }
    }

    const handleDragEnd = async (event) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIndex = categories.findIndex(c => c.id === active.id)
        const newIndex = categories.findIndex(c => c.id === over.id)
        const reordered = arrayMove(categories, oldIndex, newIndex)
        setCategories(reordered)
        try {
            await api.post('/api/menu/categories/reorder',
                reordered.map((c, i) => ({ id: c.id, sort_order: i }))
            )
        } catch { toast.error('Reorder failed') }
    }

    // ─── Item CRUD ────────────────────────────────────
    const openAddItem = () => {
        setEditingItem(null)
        setItemForm({
            name: '', description: '', price: '', preparation_time: 10,
            is_veg: true, is_available: true, photo_url: '', category_id: selectedCatId || '',
        })
        setFormErrors({})
        setModalOpen(true)
    }

    const openEditItem = (item) => {
        setEditingItem(item)
        setItemForm({
            name: item.name,
            description: item.description || '',
            price: String(item.price),
            preparation_time: item.preparation_time,
            is_veg: item.is_veg,
            is_available: item.is_available,
            photo_url: item.photo_url || '',
            category_id: item.category_id,
        })
        setFormErrors({})
        setModalOpen(true)
    }

    const saveItem = async () => {
        const errors = {}
        if (!itemForm.name.trim()) errors.name = 'Required'
        if (!itemForm.price || Number(itemForm.price) <= 0) errors.price = 'Must be > 0'
        if (Object.keys(errors).length) { setFormErrors(errors); return }

        setSaving(true)
        try {
            if (editingItem) {
                await api.put(`/api/menu/items/${editingItem.id}`, {
                    ...itemForm,
                    price: Number(itemForm.price),
                })
                toast.success('Item saved!')
            } else {
                await api.post('/api/menu/items', {
                    ...itemForm,
                    restaurant_id: effectiveRestaurantId,
                    price: Number(itemForm.price),
                })
                toast.success('Item added!')
            }
            setModalOpen(false)
            fetchItems(selectedCatId)
        } catch (err) { toast.error(err.response?.data?.detail || 'Save failed') }
        finally { setSaving(false) }
    }

    const toggleAvailability = async (item) => {
        const prev = item.is_available
        setItems(items.map(i => i.id === item.id ? { ...i, is_available: !prev } : i))
        try {
            await api.patch(`/api/menu/items/${item.id}/toggle`)
        } catch {
            setItems(items.map(i => i.id === item.id ? { ...i, is_available: prev } : i))
            toast.error('Toggle failed')
        }
    }

    const deleteItem = async (itemId) => {
        try {
            await api.delete(`/api/menu/items/${itemId}`)
            setDeleteConfirm(null)
            fetchItems(selectedCatId)
            toast.success('Item deleted')
        } catch (err) { toast.error(err.response?.data?.detail || 'Delete failed'); setDeleteConfirm(null) }
    }

    // ─── Photo upload ─────────────────────────────────
    const handlePhotoUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        try {
            const form = new FormData()
            form.append('file', file)
            const res = await api.post(`/api/upload?restaurant_id=${effectiveRestaurantId}`, form)
            setItemForm(prev => ({ ...prev, photo_url: res.data.url }))
            toast.success('Photo uploaded')
        } catch (err) { toast.error(err.response?.data?.detail || 'Upload failed') }
        finally { setUploading(false) }
    }

    // ─── Focus refs ───────────────────────────────────
    useEffect(() => { if (addingCat) addCatRef.current?.focus() }, [addingCat])
    useEffect(() => { if (editingCatId) editCatRef.current?.focus() }, [editingCatId])

    const selectedCat = categories.find(c => c.id === selectedCatId)

    // ─── RENDER ───────────────────────────────────────
    return (
        <div>
            <div style={{ display: 'flex', height: 'calc(100vh - 57px)' }}>
                {/* ─── Left: Categories ─────────────────── */}
                <div style={{
                    width: 240, borderRight: '1px solid var(--stone-200)',
                    background: 'var(--white)', display: 'flex', flexDirection: 'column', flexShrink: 0,
                }}>
                    <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid var(--stone-100)' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--stone-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Categories</p>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                        {loadingCats ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{ height: 40, background: 'var(--stone-100)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
                                ))}
                            </div>
                        ) : (
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                                    {categories.map(cat => (
                                        <SortableCategoryRow
                                            key={cat.id}
                                            cat={cat}
                                            isSelected={selectedCatId === cat.id}
                                            isEditing={editingCatId === cat.id}
                                            editCatName={editCatName}
                                            editCatRef={editCatRef}
                                            onSelect={() => setSelectedCatId(cat.id)}
                                            onEditStart={() => { setEditingCatId(cat.id); setEditCatName(cat.name) }}
                                            onEditChange={setEditCatName}
                                            onEditSave={() => renameCategory(cat.id)}
                                            onEditCancel={() => setEditingCatId(null)}
                                            onDelete={() => setDeleteConfirm({ type: 'category', id: cat.id, name: cat.name })}
                                        />
                                    ))}
                                </SortableContext>
                            </DndContext>
                        )}

                        {/* Add category inline */}
                        {addingCat && (
                            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, padding: '0 4px' }}>
                                <input
                                    ref={addCatRef}
                                    value={newCatName}
                                    onChange={(e) => setNewCatName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') addCategory()
                                        if (e.key === 'Escape') { setAddingCat(false); setNewCatName('') }
                                    }}
                                    placeholder="Category name"
                                    style={{ flex: 1, fontSize: 13, padding: '6px 8px', border: '1px solid var(--stone-300)', borderRadius: 6, outline: 'none' }}
                                />
                                <button onClick={addCategory} style={{ color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✓</button>
                                <button onClick={() => { setAddingCat(false); setNewCatName('') }} style={{ color: 'var(--stone-400)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
                            </div>
                        )}
                    </div>

                    <div style={{ padding: 8, borderTop: '1px solid var(--stone-100)' }}>
                        <button
                            onClick={() => setAddingCat(true)}
                            style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13, fontWeight: 500, color: 'var(--stone-500)', background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--stone-50)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                            + Add Category
                        </button>
                    </div>
                </div>

                {/* ─── Right: Items ─────────────────────── */}
                <div style={{ flex: 1, overflowY: 'auto', background: 'var(--cream)' }}>
                    {!selectedCatId ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--stone-400)', fontSize: 14 }}>
                            ← Select a category to manage items
                        </div>
                    ) : (
                        <div style={{ padding: 24, maxWidth: 900 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--stone-900)' }}>
                                    {selectedCat?.name}
                                </h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <button onClick={() => setImportModalOpen(true)} className="btn btn-secondary">
                                        Import from Photo
                                    </button>
                                    <button onClick={openAddItem} className="btn btn-primary">
                                        + Add Item
                                    </button>
                                </div>
                            </div>

                            {loadingItems ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                                    {[1, 2].map(i => (
                                        <div key={i} className="menu-card" style={{ animation: 'pulse 1.5s infinite' }}>
                                            <div style={{ height: 160, background: 'var(--stone-100)', borderRadius: 8, marginBottom: 12 }} />
                                            <div style={{ height: 20, background: 'var(--stone-100)', borderRadius: 4, width: '75%', marginBottom: 8 }} />
                                            <div style={{ height: 16, background: 'var(--stone-100)', borderRadius: 4, width: '50%' }} />
                                        </div>
                                    ))}
                                </div>
                            ) : items.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--stone-400)', fontSize: 14 }}>
                                    No items yet. Add your first item →
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                                    {items.map(item => (
                                        <ItemCard
                                            key={item.id}
                                            item={item}
                                            onToggle={() => toggleAvailability(item)}
                                            onEdit={() => openEditItem(item)}
                                            onDelete={() => setDeleteConfirm({ type: 'item', id: item.id, name: item.name })}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Add/Edit Item Modal ──────────────────── */}
            {modalOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setModalOpen(false)} />
                    <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 520, margin: '0 16px', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-xl)' }}>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
                            {editingItem ? 'Edit Item' : 'Add Item'}
                        </h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Name */}
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--stone-600)', marginBottom: 4 }}>Item Name *</label>
                                <input value={itemForm.name}
                                    onChange={e => setItemForm(p => ({ ...p, name: e.target.value }))}
                                    className="form-input" />
                                {formErrors.name && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{formErrors.name}</p>}
                            </div>

                            {/* Category */}
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--stone-600)', marginBottom: 4 }}>Category *</label>
                                <select value={itemForm.category_id}
                                    onChange={e => setItemForm(p => ({ ...p, category_id: e.target.value }))}
                                    className="form-input">
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Description */}
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--stone-600)', marginBottom: 4 }}>Description</label>
                                <textarea rows={3} value={itemForm.description}
                                    onChange={e => setItemForm(p => ({ ...p, description: e.target.value }))}
                                    className="form-input" style={{ resize: 'none' }} />
                            </div>

                            {/* Price + Prep time */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--stone-600)', marginBottom: 4 }}>Price (₹) *</label>
                                    <input type="number" min="0" step="0.5" value={itemForm.price}
                                        onChange={e => setItemForm(p => ({ ...p, price: e.target.value }))}
                                        className="form-input" />
                                    {formErrors.price && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{formErrors.price}</p>}
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--stone-600)', marginBottom: 4 }}>Prep Time (min)</label>
                                    <input type="number" min="1" value={itemForm.preparation_time}
                                        onChange={e => setItemForm(p => ({ ...p, preparation_time: parseInt(e.target.value) || 10 }))}
                                        className="form-input" />
                                </div>
                            </div>

                            {/* Toggles */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                                    <button type="button"
                                        onClick={() => setItemForm(p => ({ ...p, is_veg: !p.is_veg }))}
                                        style={{ width: 40, height: 20, borderRadius: 999, position: 'relative', border: 'none', cursor: 'pointer', background: itemForm.is_veg ? '#16a34a' : '#dc2626', transition: 'background 0.2s' }}>
                                        <span style={{ position: 'absolute', top: 2, width: 16, height: 16, background: 'white', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s', left: itemForm.is_veg ? 22 : 2 }} />
                                    </button>
                                    {itemForm.is_veg ? 'Veg' : 'Non-Veg'}
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                                    <button type="button"
                                        onClick={() => setItemForm(p => ({ ...p, is_available: !p.is_available }))}
                                        style={{ width: 40, height: 20, borderRadius: 999, position: 'relative', border: 'none', cursor: 'pointer', background: itemForm.is_available ? '#16a34a' : 'var(--stone-300)', transition: 'background 0.2s' }}>
                                        <span style={{ position: 'absolute', top: 2, width: 16, height: 16, background: 'white', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s', left: itemForm.is_available ? 22 : 2 }} />
                                    </button>
                                    Available
                                </label>
                            </div>

                            {/* Photo */}
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--stone-600)', marginBottom: 4 }}>Photo</label>
                                {itemForm.photo_url ? (
                                    <div style={{ position: 'relative' }}>
                                        <img src={itemForm.photo_url} alt="Preview" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8 }} />
                                        <button type="button"
                                            onClick={() => setItemForm(p => ({ ...p, photo_url: '' }))}
                                            style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: 9999, padding: '2px 8px', fontSize: 12, color: '#dc2626', cursor: 'pointer' }}>
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                                        style={{ width: '100%', height: 128, border: '2px dashed var(--stone-300)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--stone-400)', background: 'none', cursor: 'pointer', transition: 'border-color 0.15s' }}>
                                        {uploading ? (
                                            <span style={{ fontSize: 14 }}>Uploading...</span>
                                        ) : (
                                            <>
                                                <svg style={{ width: 32, height: 32, marginBottom: 4 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                <span style={{ fontSize: 12 }}>Click to upload</span>
                                            </>
                                        )}
                                    </button>
                                )}
                                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                                    onChange={handlePhotoUpload} style={{ display: 'none' }} />
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
                            <button onClick={() => setModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                            <button onClick={saveItem} disabled={saving} className="btn btn-primary" style={{ flex: 1 }}>
                                {saving ? 'Saving...' : editingItem ? 'Save Item' : 'Add Item'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Delete Confirm Dialog ────────────────── */}
            {deleteConfirm && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setDeleteConfirm(null)} />
                    <div className="card" style={{ position: 'relative', width: '100%', maxWidth: 360, margin: '0 16px', boxShadow: 'var(--shadow-xl)' }}>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                            Delete {deleteConfirm.name}?
                        </h3>
                        <p style={{ fontSize: 14, color: 'var(--stone-500)', marginBottom: 20 }}>This cannot be undone.</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => setDeleteConfirm(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                            <button onClick={() => {
                                if (deleteConfirm.type === 'category') deleteCategory(deleteConfirm.id)
                                else deleteItem(deleteConfirm.id)
                            }} className="btn btn-danger" style={{ flex: 1 }}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Import from Photo Modal ────────────── */}
            {importModalOpen && (
                <MenuImportModal
                    onClose={() => setImportModalOpen(false)}
                    effectiveRestaurantId={effectiveRestaurantId}
                    onImportComplete={() => {
                        fetchCategories()
                        if (selectedCatId) fetchItems(selectedCatId)
                    }}
                />
            )}
        </div>
    )
}


// ─── Sortable Category Row ────────────────────────────────

function SortableCategoryRow({ cat, isSelected, isEditing, editCatName, editCatRef, onSelect, onEditStart, onEditChange, onEditSave, onEditCancel, onDelete }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id })
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }

    return (
        <div
            ref={setNodeRef}
            style={{
                ...style,
                display: 'flex', alignItems: 'center', gap: 4, padding: '8px', borderRadius: 8,
                marginBottom: 2, cursor: 'pointer', transition: 'background 0.15s',
                background: isSelected ? 'var(--saffron-light, #FEF3C7)' : 'transparent',
                fontWeight: isSelected ? 600 : 400,
            }}
            onClick={onSelect}
        >
            {/* Drag handle */}
            <span {...attributes} {...listeners}
                style={{ color: 'var(--stone-300)', cursor: 'grab', fontSize: 14, flexShrink: 0 }}
                onClick={e => e.stopPropagation()}>
                ⠿
            </span>

            {isEditing ? (
                <input
                    ref={editCatRef}
                    value={editCatName}
                    onChange={e => onEditChange(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') onEditSave()
                        if (e.key === 'Escape') onEditCancel()
                    }}
                    onBlur={onEditSave}
                    onClick={e => e.stopPropagation()}
                    style={{ flex: 1, fontSize: 13, padding: '2px 6px', border: '1px solid var(--stone-300)', borderRadius: 6, outline: 'none' }}
                />
            ) : (
                <span style={{ flex: 1, fontSize: 13, color: 'var(--stone-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cat.name}
                </span>
            )}

            {/* Actions (visible on hover via group) */}
            {!isEditing && (
                <div className="cat-actions" style={{ display: 'none', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    <button onClick={e => { e.stopPropagation(); onEditStart() }}
                        style={{ color: 'var(--stone-400)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 12 }}
                        title="Rename">✏️</button>
                    <button onClick={e => { e.stopPropagation(); onDelete() }}
                        style={{ color: 'var(--stone-400)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 12 }}
                        title="Delete">🗑</button>
                </div>
            )}
        </div>
    )
}


// ─── Item Card ────────────────────────────────────────────

function ItemCard({ item, onToggle, onEdit, onDelete }) {
    return (
        <div className="menu-card" style={{ opacity: item.is_available ? 1 : 0.6 }}>
            {/* Photo — edge-to-edge, no padding, no border-radius (card handles it) */}
            <div style={{ height: 180, background: 'var(--cream-dark)', position: 'relative', overflow: 'hidden' }}>
                {item.photo_url ? (
                    <img src={item.photo_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--stone-300)' }}>
                        <svg style={{ width: 48, height: 48 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                )}
                {/* Veg/Non-veg indicator — white circle bg for visibility */}
                <span style={{
                    position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)',
                    background: 'white', padding: 4, borderRadius: '50%',
                    boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <span style={{
                        width: 10, height: 10, borderRadius: '50%',
                        border: `2px solid ${item.is_veg ? '#16a34a' : '#dc2626'}`,
                        background: item.is_veg ? '#16a34a' : '#dc2626',
                    }} />
                </span>
            </div>

            {/* Card body — padded */}
            <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--stone-900)', marginBottom: 'var(--space-1)' }}>{item.name}</h3>
                {item.description && (
                    <p style={{ fontSize: 12, color: 'var(--stone-500)', marginBottom: 'var(--space-3)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.description}</p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'var(--space-3)' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>₹{item.price}</span>
                    <span style={{ fontSize: 12, color: 'var(--stone-400)' }}>{item.preparation_time} min</span>
                </div>

                {/* Actions row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--cream-border)' }}>
                    <button type="button" onClick={onToggle}
                        style={{ width: 40, height: 20, borderRadius: 999, position: 'relative', border: 'none', cursor: 'pointer', background: item.is_available ? '#16a34a' : 'var(--stone-300)', transition: 'background 0.2s', flexShrink: 0 }}>
                        <span style={{ position: 'absolute', top: 2, width: 16, height: 16, background: 'white', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s', left: item.is_available ? 22 : 2 }} />
                    </button>
                    <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={onEdit} style={{ fontSize: 12, color: 'var(--stone-500)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}>Edit</button>
                        <button onClick={onDelete} style={{ fontSize: 12, color: 'var(--stone-500)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}>Delete</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
