export default function CartDrawer({
    isOpen,
    onClose,
    cartItems,
    menuItemsMap,
    onUpdateQty,
    onPlaceOrder,
    customerNote,
    onNoteChange,
    isPlacing,
}) {
    if (!isOpen) return null

    const total = cartItems.reduce((sum, ci) => {
        const item = menuItemsMap[ci.id]
        return sum + (item ? Number(item.price) * ci.quantity : 0)
    }, 0)

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />

            {/* Drawer */}
            <div className="relative bg-white rounded-t-2xl max-h-[85vh] flex flex-col animate-slide-up">
                <div className="p-5 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-900">Your Order</h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none cursor-pointer">&times;</button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {cartItems.map((ci) => {
                        const item = menuItemsMap[ci.id]
                        if (!item) return null
                        return (
                            <div key={ci.id} className="flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                                    <p className="text-xs text-gray-500">₹{item.price}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => onUpdateQty(ci.id, ci.quantity - 1)}
                                        className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-sm hover:bg-gray-100 cursor-pointer"
                                    >−</button>
                                    <span className="text-sm font-medium w-4 text-center">{ci.quantity}</span>
                                    <button
                                        onClick={() => onUpdateQty(ci.id, ci.quantity + 1)}
                                        className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-sm hover:bg-gray-100 cursor-pointer"
                                    >+</button>
                                    <span className="text-sm font-medium text-gray-700 w-14 text-right">
                                        ₹{(Number(item.price) * ci.quantity).toFixed(0)}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="p-5 border-t border-gray-100 space-y-3">
                    <textarea
                        value={customerNote}
                        onChange={(e) => onNoteChange(e.target.value)}
                        placeholder="Any special requests?"
                        className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none h-16 focus:outline-none focus:ring-2 focus:ring-gray-300"
                    />

                    <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-gray-900">Total: ₹{total.toFixed(0)}</span>
                    </div>

                    <button
                        onClick={onPlaceOrder}
                        disabled={isPlacing || cartItems.length === 0}
                        className="w-full py-3 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                        {isPlacing ? 'Placing...' : 'Place Order'}
                    </button>

                    <button
                        onClick={onClose}
                        className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
                    >
                        Continue browsing
                    </button>
                </div>
            </div>
        </div>
    )
}
