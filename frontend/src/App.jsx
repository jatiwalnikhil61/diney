import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { setupInterceptors } from './services/api'
import PrivateRoute from './components/PrivateRoute'
import ErrorBoundary from './components/ErrorBoundary'
import Sidebar from './components/Sidebar'
import Landing from './pages/Landing'
import Login from './pages/Login'
import AccessDenied from './pages/AccessDenied'
import CustomerMenu from './pages/CustomerMenu'
import OrderStatus from './pages/OrderStatus'
import KitchenDashboard from './pages/KitchenDashboard'
import WaiterDashboard from './pages/WaiterDashboard'
import AnalyticsDashboard from './pages/AnalyticsDashboard'
import OrderHistory from './pages/OrderHistory'
import AdminTables from './pages/AdminTables'
import MenuManagement from './pages/MenuManagement'
import StaffManagement from './pages/StaffManagement'
import RestaurantProfile from './pages/RestaurantProfile'
import SuperAdminOverview from './pages/SuperAdminOverview'
import SuperAdminRestaurants from './pages/SuperAdminRestaurants'
import SuperAdminRestaurantDetail from './pages/SuperAdminRestaurantDetail'
import ProcessConfigPage from './pages/ProcessConfig'

// Wraps protected pages with the sidebar shell
function ShellLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    sessionStorage.getItem('sidebarOpen') !== 'false'
  )

  const toggleSidebar = () => {
    setSidebarOpen(prev => {
      const next = !prev
      sessionStorage.setItem('sidebarOpen', String(next))
      return next
    })
  }

  return (
    <div className="app-shell">
      <Sidebar sidebarOpen={sidebarOpen} onToggle={toggleSidebar} />
      <main className="main-content" style={{
        marginLeft: sidebarOpen ? 'var(--sidebar-width)' : 0,
        paddingLeft: sidebarOpen ? 0 : 48,
      }}>
        {children}
      </main>
    </div>
  )
}

function AppRoutes() {
  const auth = useAuth()
  const location = useLocation()

  useEffect(() => {
    setupInterceptors(auth.logout)
  }, [auth.logout])

  return (
    <div key={location.pathname} className="page-enter">
      <Routes>
        {/* Public — no sidebar */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/menu/:qrToken" element={<CustomerMenu />} />
        <Route path="/menu/:qrToken/order/:orderId" element={<OrderStatus />} />
        <Route path="/access-denied" element={<AccessDenied />} />

        {/* Protected — sidebar shell */}
        <Route path="/dashboard" element={
          <PrivateRoute role="OWNER" module="owner_dashboard">
            <ShellLayout><AnalyticsDashboard /></ShellLayout>
          </PrivateRoute>
        } />
        <Route path="/dashboard/orders" element={
          <PrivateRoute role="OWNER" module="owner_dashboard">
            <ShellLayout><OrderHistory /></ShellLayout>
          </PrivateRoute>
        } />
        <Route path="/dashboard/kitchen" element={
          <PrivateRoute requireKitchenAccess module="kitchen_module">
            <ShellLayout><KitchenDashboard /></ShellLayout>
          </PrivateRoute>
        } />
        <Route path="/dashboard/waiter" element={
          <PrivateRoute requireWaiterAccess module="waiter_module">
            <ShellLayout><WaiterDashboard /></ShellLayout>
          </PrivateRoute>
        } />
        <Route path="/admin/tables" element={
          <PrivateRoute role="OWNER">
            <ShellLayout><AdminTables /></ShellLayout>
          </PrivateRoute>
        } />
        <Route path="/dashboard/menu" element={
          <PrivateRoute role="OWNER" module="menu_management">
            <ShellLayout><MenuManagement /></ShellLayout>
          </PrivateRoute>
        } />
        <Route path="/dashboard/staff" element={
          <PrivateRoute role="OWNER" module="staff_management">
            <ShellLayout><StaffManagement /></ShellLayout>
          </PrivateRoute>
        } />
        <Route path="/dashboard/profile" element={
          <PrivateRoute role="OWNER">
            <ShellLayout><RestaurantProfile /></ShellLayout>
          </PrivateRoute>
        } />
        <Route path="/dashboard/config" element={
          <PrivateRoute role="OWNER">
            <ShellLayout><ProcessConfigPage /></ShellLayout>
          </PrivateRoute>
        } />

        {/* Super Admin */}
        <Route path="/superadmin" element={
          <PrivateRoute role="SUPER_ADMIN">
            <ShellLayout><SuperAdminOverview /></ShellLayout>
          </PrivateRoute>
        } />
        <Route path="/superadmin/restaurants" element={
          <PrivateRoute role="SUPER_ADMIN">
            <ShellLayout><SuperAdminRestaurants /></ShellLayout>
          </PrivateRoute>
        } />
        <Route path="/superadmin/restaurants/:id" element={
          <PrivateRoute role="SUPER_ADMIN">
            <ShellLayout><SuperAdminRestaurantDetail /></ShellLayout>
          </PrivateRoute>
        } />

        {/* Catch-all — unknown paths go to login, not / */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Toaster position="top-center" />
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
