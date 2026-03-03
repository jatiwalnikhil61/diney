import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import CustomerMenu from './pages/CustomerMenu'
import OrderStatus from './pages/OrderStatus'
import KitchenDashboard from './pages/KitchenDashboard'
import WaiterDashboard from './pages/WaiterDashboard'
import OwnerDashboard from './pages/OwnerDashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" />
      <Routes>
        <Route path="/menu/:qrToken" element={<CustomerMenu />} />
        <Route path="/menu/:qrToken/order/:orderId" element={<OrderStatus />} />
        <Route path="/dashboard/kitchen" element={<KitchenDashboard />} />
        <Route path="/dashboard/waiter" element={<WaiterDashboard />} />
        <Route path="/dashboard" element={<OwnerDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}
