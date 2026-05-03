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
import ErrorBoundary from '@/components/ErrorBoundary'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 2, retry: 1 } }
})

function AdminRoute() {
  const { isAdmin, loading } = useAuth()
  if (loading) return null
  if (!isAdmin) return <Navigate to="/pos" replace />
  return <Outlet />
}

// Envuelve cada page en su propio boundary para que un crash no tire toda la app
function Wrap({ children }) {
  return <ErrorBoundary>{children}</ErrorBoundary>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/pos" replace />} />
              <Route path="pos"       element={<Wrap><POSv2 /></Wrap>} />
              <Route path="productos" element={<Wrap><Products /></Wrap>} />
              <Route path="compras"   element={<Wrap><Purchases /></Wrap>} />
              <Route path="scanner"   element={<Wrap><InvoiceScanner /></Wrap>} />
              <Route path="dashboard" element={<Wrap><Dashboard /></Wrap>} />
              <Route path="gastos"    element={<Wrap><Expenses /></Wrap>} />
              <Route path="ventas"    element={<Wrap><Sales /></Wrap>} />
              <Route path="fiados"    element={<Wrap><Fiados /></Wrap>} />
              <Route path="clientes"  element={<Wrap><Clients /></Wrap>} />
              <Route path="reportes"  element={<Wrap><Reports /></Wrap>} />
              <Route element={<AdminRoute />}>
                <Route path="config" element={<Wrap><Settings /></Wrap>} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  )
}
