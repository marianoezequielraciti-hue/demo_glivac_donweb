import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import ProtectedRoute from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import POSv2 from '@/pages/POSv2'
import Products from '@/pages/Products'
import Purchases from '@/pages/Purchases'
import Sales from '@/pages/Sales'
import Expenses from '@/pages/Expenses'
import Reports from '@/pages/Reports'
import InvoiceScanner from '@/pages/InvoiceScanner'
import Settings from '@/pages/Settings'
import Fiados from '@/pages/Fiados'
import Clients from '@/pages/Clients'
import { useAuth } from '@/hooks/useAuth'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 2, retry: 1 } }
})

function AdminRoute() {
  const { isAdmin, loading } = useAuth()
  if (loading) return null
  if (!isAdmin) return <Navigate to="/pos" replace />
  return <Outlet />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/pos" replace />} />
              <Route path="pos" element={<POSv2 />} />
              <Route path="productos" element={<Products />} />
              <Route path="compras" element={<Purchases />} />
              <Route path="scanner" element={<InvoiceScanner />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="gastos" element={<Expenses />} />
              <Route path="ventas" element={<Sales />} />
              <Route path="fiados" element={<Fiados />} />
              <Route path="clientes" element={<Clients />} />
              <Route element={<AdminRoute />}>
                <Route path="reportes" element={<Reports />} />
                <Route path="config" element={<Settings />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  )
}
