import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useDarkMode } from '@/hooks/useDarkMode'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', adminOnly: false },
  { to: '/pos', label: 'Punto de Venta', adminOnly: false },
  { to: '/productos', label: 'Productos', adminOnly: false },
  { to: '/compras', label: 'Compras', adminOnly: false },
  { to: '/ventas', label: 'Ventas', adminOnly: false },
  { to: '/gastos', label: 'Gastos', adminOnly: false },
  { to: '/fiados', label: 'Fiados', adminOnly: false },
  { to: '/clientes', label: 'Clientes', adminOnly: false },
  { to: '/reportes', label: 'Reportes', adminOnly: false },
  // { to: '/scanner', label: 'Scanner', adminOnly: false },
  { to: '/config', label: 'Config', adminOnly: false },
]

export default function Layout() {
  const { logout, isAdmin, storeName } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { dark, toggle: toggleDark } = useDarkMode()

  const visibleNav = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin)

  const linkClass = ({ isActive }) =>
    `px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
      isActive
        ? 'bg-zinc-900 text-white'
        : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
    }`

  return (
    <div className="min-h-screen bg-[#c0c0c0] dark:bg-zinc-950">
      <header className="bg-white/85 dark:bg-zinc-900/92 backdrop-blur-xl border-b border-zinc-200/60 dark:border-zinc-700/60 fixed inset-x-0 top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="text-sm font-semibold tracking-[0.15em] text-zinc-900 shrink-0">
            {storeName ? storeName.toUpperCase() : 'GLIVAC'}
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
              onClick={toggleDark}
              title={dark ? 'Modo claro' : 'Modo oscuro'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {dark ? (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={logout}
              className="hidden md:inline-flex px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-full text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
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
          <nav className="md:hidden bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800">
            <div className="px-4 py-3 flex flex-col gap-1">
              {visibleNav.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive ? 'bg-zinc-900 text-white' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
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
                className="mt-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left transition-colors"
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
