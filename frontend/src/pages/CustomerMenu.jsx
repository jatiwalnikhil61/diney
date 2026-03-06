import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'
import CartDrawer from '../components/CartDrawer'
import CustomerVerification from '../components/CustomerVerification'
import CustomerOrderTracker from '../components/CustomerOrderTracker'
import { useCustomerAuth } from '../context/CustomerAuthContext'

export default function CustomerMenu() {
    const { qrToken } = useParams()
    const navigate = useNavigate()
    const { customer, loading: authLoading } = useCustomerAuth()
    const [menu, setMenu] = useState(null)
    const [error, setError] = useState(null)
    const [activeCategory, setActiveCategory] = useState(null)
    const [cart, setCart] = useState([]) // [{ id, quantity }]
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [customerNote, setCustomerNote] = useState('')
    const [isPlacing, setIsPlacing] = useState(false)
    const [orderPlaced, setOrderPlaced] = useState(null) // { orderId, showStatus }
    const sectionRefs = useRef({})

    useEffect(() => {
        api.get(`/api/public/menu/${qrToken}`)
            .then(res => {
                setMenu(res.data)
                if (res.data.categories.length > 0) {
                    setActiveCategory(res.data.categories[0].id)
                }
            })
            .catch(() => setError('Table not found'))
    }, [qrToken])

    // Build a flat map of all menu items for the cart drawer
    const menuItemsMap = {}
    if (menu) {
        menu.categories.forEach(cat => {
            cat.items.forEach(item => {
                menuItemsMap[item.id] = item
            })
        })
    }

    const getCartQty = (itemId) => {
        const ci = cart.find(c => c.id === itemId)
        return ci ? ci.quantity : 0
    }

    const updateCart = (itemId, qty) => {
        if (qty <= 0) {
            setCart(cart.filter(c => c.id !== itemId))
        } else {
            const existing = cart.find(c => c.id === itemId)
            if (existing) {
                setCart(cart.map(c => c.id === itemId ? { ...c, quantity: qty } : c))
            } else {
                setCart([...cart, { id: itemId, quantity: qty }])
            }
        }
    }

    const totalItems = cart.reduce((s, c) => s + c.quantity, 0)
    const totalPrice = cart.reduce((s, c) => {
        const item = menuItemsMap[c.id]
        return s + (item ? Number(item.price) * c.quantity : 0)
    }, 0)

    const scrollToCategory = (catId) => {
        setActiveCategory(catId)
        sectionRefs.current[catId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    const placeOrder = async () => {
        setIsPlacing(true)
        try {
            const payload = {
                items: cart.map(c => ({
                    menu_item_id: c.id,
                    quantity: c.quantity,
                })),
                customer_note: customerNote || null,
            }
            const res = await api.post(`/api/public/orders/${qrToken}`, payload)
            toast.success('Order placed!')

            // If customer status tracking is enabled, navigate to status page
            if (res.data.show_status_page !== false) {
                navigate(`/menu/${qrToken}/order/${res.data.order_id}`)
            } else {
                // Show inline confirmation (no status tracking)
                setOrderPlaced({
                    orderId: res.data.order_id,
                    estimatedMinutes: res.data.estimated_minutes,
                })
                setCart([])
                setDrawerOpen(false)
            }
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to place order')
        } finally {
            setIsPlacing(false)
        }
    }

    // Order placed inline confirmation (when status tracking is OFF)
    if (orderPlaced) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 32,
                textAlign: 'center',
                background: '#fff',
            }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
                <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
                    Order Confirmed!
                </h1>
                <p style={{ fontSize: 16, color: '#6b7280', marginBottom: 8 }}>
                    Your order has been placed successfully.
                </p>
                <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 24 }}>
                    Estimated time: ~{orderPlaced.estimatedMinutes || 10} minutes
                </p>
                <button
                    onClick={() => setOrderPlaced(null)}
                    style={{
                        padding: '12px 32px',
                        background: '#111827',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 12,
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    Order More
                </button>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
                <div className="text-center">
                    <p className="text-6xl mb-4">😕</p>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Table Not Found</h1>
                    <p className="text-gray-500">This QR code is invalid or the table is inactive.</p>
                </div>
            </div>
        )
    }

    // Show spinner while menu OR auth are still loading
    if (!menu || authLoading) {
        return (
            <div className="min-h-screen bg-gray-50 animate-pulse">
                <div className="bg-white border-b border-gray-100 px-5 pt-6 pb-4">
                    <div className="h-7 bg-gray-200 rounded w-40 mb-2" />
                    <div className="h-5 bg-gray-200 rounded w-20" />
                </div>
                <div className="bg-white border-b border-gray-100 px-4 py-2 flex gap-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-8 bg-gray-200 rounded-full w-20" />)}
                </div>
                <div className="px-4 py-4 space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="bg-white rounded-xl p-4 border border-gray-100">
                            <div className="flex items-start justify-between">
                                <div className="flex-1 space-y-2 pr-3">
                                    <div className="h-4 bg-gray-200 rounded w-32" />
                                    <div className="h-3 bg-gray-200 rounded w-48" />
                                    <div className="h-4 bg-gray-200 rounded w-16" />
                                </div>
                                <div className="h-8 bg-gray-200 rounded-lg w-16" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    // Auth gate — menu is loaded so we have restaurant_id
    if (!customer) {
        return (
            <CustomerVerification
                restaurantId={String(menu.restaurant_id)}
                restaurantName={menu.restaurant_name}
            />
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 px-5 pt-6 pb-4 sticky top-0 z-30">
                <h1 className="text-2xl font-bold text-gray-900">{menu.restaurant_name}</h1>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                    Table {menu.table_number}
                </span>
            </div>

            {/* Category tabs */}
            <div className="sticky top-[85px] z-20 bg-white border-b border-gray-100 px-4 py-2 overflow-x-auto flex gap-2 scrollbar-hide">
                {menu.categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => scrollToCategory(cat.id)}
                        className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${activeCategory === cat.id
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        {cat.name}
                    </button>
                ))}
            </div>

            {/* Menu sections */}
            <div className="px-4 py-4 space-y-6">
                {menu.categories.map(cat => (
                    <div key={cat.id} ref={el => sectionRefs.current[cat.id] = el}>
                        <h2 className="text-lg font-bold text-gray-900 mb-3">{cat.name}</h2>
                        <div className="space-y-3">
                            {cat.items.map(item => {
                                const qty = getCartQty(item.id)
                                return (
                                    <div key={item.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`w-3.5 h-3.5 rounded-sm border-2 shrink-0 flex items-center justify-center ${item.is_veg ? 'border-green-600' : 'border-red-600'}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${item.is_veg ? 'bg-green-600' : 'bg-red-600'}`} />
                                                    </span>
                                                    <span className="font-semibold text-gray-900 text-sm">{item.name}</span>
                                                </div>
                                                {item.description && (
                                                    <p className="text-xs text-gray-500 line-clamp-2 mb-1">{item.description}</p>
                                                )}
                                                <p className="text-sm font-semibold text-gray-800">₹{item.price}</p>
                                            </div>

                                            <div className="shrink-0 flex flex-col items-end gap-2">
                                                {item.photo_url && (
                                                    <img
                                                        src={item.photo_url}
                                                        alt={item.name}
                                                        className="w-20 h-20 rounded-lg object-cover border border-gray-100"
                                                    />
                                                )}
                                                {qty === 0 ? (
                                                    <button
                                                        onClick={() => updateCart(item.id, 1)}
                                                        className="px-5 py-1.5 rounded-lg border border-gray-900 text-gray-900 text-sm font-semibold hover:bg-gray-900 hover:text-white transition-colors cursor-pointer"
                                                    >
                                                        Add
                                                    </button>
                                                ) : (
                                                    <div className="flex items-center gap-3 border border-gray-300 rounded-lg px-2 py-1">
                                                        <button onClick={() => updateCart(item.id, qty - 1)} className="text-gray-600 hover:text-gray-900 font-semibold cursor-pointer">−</button>
                                                        <span className="text-sm font-semibold w-4 text-center">{qty}</span>
                                                        <button onClick={() => updateCart(item.id, qty + 1)} className="text-gray-600 hover:text-gray-900 font-semibold cursor-pointer">+</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Cart bar */}
            {totalItems > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-white border-t border-gray-200">
                    <button
                        onClick={() => setDrawerOpen(true)}
                        className="w-full py-3 px-5 rounded-xl bg-gray-900 text-white font-semibold text-sm flex items-center justify-between hover:bg-gray-700 transition-colors cursor-pointer"
                    >
                        <span>{totalItems} item{totalItems > 1 ? 's' : ''} | ₹{totalPrice.toFixed(0)}</span>
                        <span>Review Order →</span>
                    </button>
                </div>
            )}

            {/* Order tracker — visible to verified customers */}
            <CustomerOrderTracker restaurantId={String(menu.restaurant_id)} />

            {/* Cart Drawer */}
            <CartDrawer
                isOpen={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                cartItems={cart}
                menuItemsMap={menuItemsMap}
                onUpdateQty={updateCart}
                onPlaceOrder={placeOrder}
                customerNote={customerNote}
                onNoteChange={setCustomerNote}
                isPlacing={isPlacing}
            />
        </div>
    )
}
