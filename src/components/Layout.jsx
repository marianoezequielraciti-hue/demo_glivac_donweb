import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', adminOnly: false },
  { to: '/pos', label: 'Punto de Venta', adminOnly: false },
  { to: '/productos', label: 'Productos', adminOnly: false },
  { to: '/compras', label: 'Compras', adminOnly: false },
  { to: '/ventas', label: 'Ventas', adminOnly: false },
  { to: '/gastos', label: 'Gastos', adminOnly: false },
  { to: '/fiados', label: 'Fiados', adminOnly: false },
  { to: '/reportes', label: 'Reportes', adminOnly: true },
  { to: '/scanner', label: 'Scanner', adminOnly: false },
  { to: '/config', label: 'Config', adminOnly: true },
]

export default function Layout() {
  const { logout, isAdmin, storeName } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const visibleNav = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin)

  const linkClass = ({ isActive }) =>
    `px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
      isActive
        ? 'bg-zinc-900 text-white'
        : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
    }`

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <header className="bg-white/85 backdrop-blur-xl border-b border-zinc-200/60 fixed inset-x-0 top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="text-sm font-semibold tracking-[0.15em] text-zinc-900 shrink-0">
            {storeName ? storeName.toUpperCase() : 'VALE'}
          </div>
          <nav className="hidden md:flex gap-1 flex-1 justify-center">
            {visibleNav.map(({ to, label }) => (
              <NavLink key={to} to={to} className={linkClass}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={logout}
              className="hidden md:inline-flex px-3 py-1.5 border border-zinc-200 text-zinc-700 rounded-full text-sm font-medium hover:bg-zinc-50 transition-colors"
            >
              Salir
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-700 md:hidden transition-colors"
              aria-label="Abrir menú"
            >
              {mobileOpen ? (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <nav className="md:hidden bg-white border-t border-zinc-100">
            <div className="px-4 py-3 flex flex-col gap-1">
              {visibleNav.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'
                    }`
                  }
                  onClick={() => setMobileOpen(false)}
                >
                  {label}
                </NavLink>
              ))}
              <button
                type="button"
                onClick={logout}
                className="mt-2 text-sm font-medium text-zinc-500 border border-zinc-200 rounded-xl px-4 py-2.5 hover:bg-zinc-50 text-left transition-colors"
              >
                Salir
              </button>
            </div>
          </nav>
        )}
      </header>
      <main className="max-w-[1200px] mx-auto px-4 py-6 pt-20">
        <Outlet />
      </main>
    </div>
  )
}
