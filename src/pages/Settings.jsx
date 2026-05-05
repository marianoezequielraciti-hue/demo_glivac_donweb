import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { createAdminUser, listAdminUsers, updateAdminUser, deleteAdminUser } from '@/lib/adminApi'
import { ROLE_OPTIONS, roleRequiresStore, getDefaultRoleForDemo } from '@/lib/roles'
import { exportMultiSheet, PRODUCT_COLUMNS, SALE_COLUMNS, PURCHASE_COLUMNS, EXPENSE_COLUMNS } from '@/lib/xlsxUtils'
import { toast } from 'sonner'
import { Users, Database, Download, Trash2, Loader2, KeyRound, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useStoreFilter } from '@/hooks/useStoreFilter'

export default function Settings() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { stores } = useStoreFilter()
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState(getDefaultRoleForDemo())
  const [invitePassword, setInvitePassword] = useState('')
  const [inviting, setInviting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [profiles, setProfiles] = useState([])
  const [lastCredentials, setLastCredentials] = useState(null)

  // edit user modal
  const [editModal, setEditModal] = useState(null)   // profile object
  const [editRole, setEditRole] = useState('')
  const [editStore, setEditStore] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // change password modal
  const [pwModal, setPwModal] = useState(null)       // profile object
  const [newPassword, setNewPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  // delete user confirm
  const [deleteUserModal, setDeleteUserModal] = useState(null) // profile object
  const [deletingUser, setDeletingUser] = useState(false)

  const { data: counts = { products: 0, sales: 0, purchases: 0, expenses: 0 } } = useQuery({
    queryKey: ['settings-counts'],
    queryFn: async () => {
      const [p, s, pu, e] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('sales').select('*', { count: 'exact', head: true }),
        supabase.from('purchases').select('*', { count: 'exact', head: true }),
        supabase.from('expenses').select('*', { count: 'exact', head: true }),
      ])
      return { products: p.count || 0, sales: s.count || 0, purchases: pu.count || 0, expenses: e.count || 0 }
    },
    enabled: !!user,
  })

  const loadProfiles = useCallback(async () => {
    try {
      const { users } = await listAdminUsers()
      setProfiles(users || [])
    } catch {
      toast.error('No se pudo cargar la lista de usuarios')
    }
  }, [])

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  const handleInvite = async () => {
    if (!inviteUsername) {
      toast.error('Ingresá un código de acceso')
      return
    }
    if (!invitePassword) {
      toast.error('La contraseña es obligatoria')
      return
    }
    setInviting(true)
    try {
      const { credentials } = await createAdminUser({
        username: inviteUsername,
        displayName: inviteName,
        role: inviteRole,
        storeId: stores[0]?.id || null,
        password: invitePassword,
      })
      setLastCredentials({ ...credentials, username: inviteUsername })
      toast.success(`Usuario creado: ${inviteUsername}`)
      setInviteUsername('')
      setInviteName('')
      setInviteRole(getDefaultRoleForDemo())
      setInvitePassword('')
      loadProfiles()
    } catch (error) {
      toast.error('No se pudo crear el usuario: ' + error.message)
    } finally {
      setInviting(false)
    }
  }

  const fetchAll = async (table, order = 'created_at') => {
    const pageSize = 1000
    let rows = []
    let from = 0

    while (true) {
      const { data, error } = await supabase.from(table).select('*').order(order).range(from, from + pageSize - 1)
      if (error) throw error
      rows = rows.concat(data || [])
      if (!data || data.length < pageSize) break
      from += pageSize
    }

    return rows
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const [products, sales, purchases, expenses] = await Promise.all([
        fetchAll('products', 'name'),
        fetchAll('sales', 'created_at'),
        fetchAll('purchases', 'created_at'),
        fetchAll('expenses', 'date'),
      ])
      const now = new Date()
      const fecha = now.toLocaleDateString('es-AR')
      const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
      exportMultiSheet([
        {
          data: products.map((product) => ({ ...product, active: product.active ? 'Sí' : 'No' })),
          columns: PRODUCT_COLUMNS,
          sheetName: 'Productos',
          opts: { title: `Productos — ${fecha}` },
        },
        {
          data: sales.map((sale) => ({
            ...sale,
            items_summary: (sale.items || []).map((item) => `${item.product_name} ×${item.quantity}`).join(' | '),
          })),
          columns: SALE_COLUMNS,
          sheetName: 'Ventas',
          opts: { title: `Ventas — ${fecha}`, totals: { total: sales.reduce((sum, sale) => sum + (sale.total || 0), 0) } },
        },
        {
          data: purchases.map((purchase) => ({
            ...purchase,
            items_summary: (purchase.items || []).map((item) => `${item.product_name || item.name} ×${item.quantity}`).join(' | '),
          })),
          columns: PURCHASE_COLUMNS,
          sheetName: 'Compras',
          opts: { title: `Compras — ${fecha}`, totals: { total: purchases.reduce((sum, purchase) => sum + (purchase.total || 0), 0) } },
        },
        {
          data: expenses,
          columns: EXPENSE_COLUMNS,
          sheetName: 'Gastos',
          opts: { title: `Gastos — ${fecha}`, totals: { amount: expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0) } },
        },
      ], `backup_glivac_${ts}`)
      toast.success('Backup descargado correctamente')
    } catch (error) {
      toast.error('Error al exportar: ' + error.message)
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteAll = async () => {
    if (deleteConfirm !== 'ELIMINAR TODO') {
      toast.error('Escribí exactamente "ELIMINAR TODO"')
      return
    }

    setDeleting(true)
    try {
      const dummyId = '00000000-0000-0000-0000-000000000000'
      await Promise.all([
        supabase.from('sales').delete().neq('id', dummyId),
        supabase.from('purchases').delete().neq('id', dummyId),
        supabase.from('expenses').delete().neq('id', dummyId),
        supabase.from('products').delete().neq('id', dummyId),
      ])
      queryClient.invalidateQueries()
      toast.success('Todos los datos eliminados')
      setDeleteConfirm('')
    } catch (error) {
      toast.error('Error al eliminar: ' + error.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleRoleChange = async (profile, role) => {
    try {
      await updateAdminUser({
        userId: profile.id,
        role,
        storeId: roleRequiresStore(role) ? profile.store_id : null,
      })
      toast.success('Rol actualizado')
      loadProfiles()
    } catch {
      toast.error('No se pudo actualizar el rol')
    }
  }

  const handleStoreChange = async (profile, storeId) => {
    try {
      await updateAdminUser({
        userId: profile.id,
        storeId: roleRequiresStore(profile.role) ? storeId : null,
      })
      toast.success('Negocio actualizado')
      loadProfiles()
    } catch {
      toast.error('No se pudo actualizar el negocio')
    }
  }

  const handleNameChange = async (profile, username) => {
    try {
      await updateAdminUser({ userId: profile.id, username })
      toast.success('Nombre actualizado')
      loadProfiles()
    } catch {
      toast.error('No se pudo actualizar el nombre')
    }
  }

  const openEditModal = (profile) => {
    setEditModal(profile)
    setEditRole(profile.role || 'employee')
    setEditStore(profile.store_id || '')
  }

  const handleSaveEdit = async () => {
    if (!editModal) return
    setEditSaving(true)
    try {
      await updateAdminUser({
        userId: editModal.id,
        role: editRole,
        storeId: roleRequiresStore(editRole) ? (editStore || null) : null,
      })
      toast.success('Usuario actualizado')
      loadProfiles()
      setEditModal(null)
    } catch {
      toast.error('No se pudo actualizar el usuario')
    } finally {
      setEditSaving(false)
    }
  }

  const handleSavePassword = async () => {
    if (!pwModal || !newPassword.trim()) { toast.error('Ingresá una contraseña'); return }
    if (newPassword.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return }
    setPwSaving(true)
    try {
      await updateAdminUser({ userId: pwModal.id, password: newPassword })
      toast.success('Contraseña actualizada')
      setPwModal(null)
      setNewPassword('')
    } catch {
      toast.error('No se pudo cambiar la contraseña')
    } finally {
      setPwSaving(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!deleteUserModal) return
    setDeletingUser(true)
    try {
      await deleteAdminUser(deleteUserModal.id)
      toast.success('Usuario eliminado')
      loadProfiles()
      setDeleteUserModal(null)
    } catch {
      toast.error('No se pudo eliminar el usuario')
    } finally {
      setDeletingUser(false)
    }
  }

  const totalRecords = counts.products + counts.sales + counts.purchases + counts.expenses

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 text-sm mt-1">Administración de datos y accesos</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Users className="w-4 h-4" /> Gestión de empleados</h2>
        <p className="text-sm text-gray-500">Creá accesos para empleados con un código de acceso (sin email). Los empleados inician sesión con su código y contraseña.</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <input
            value={inviteUsername}
            onChange={(event) => setInviteUsername(event.target.value)}
            placeholder="Código de acceso (ej: cajero1) *"
            className="h-11 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            value={inviteName}
            onChange={(event) => setInviteName(event.target.value)}
            placeholder="Nombre visible (opcional)"
            className="h-11 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <select
            value={inviteRole}
            onChange={(event) => setInviteRole(event.target.value)}
            className="h-11 px-3 border border-gray-200 rounded-lg text-sm"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input
            type="password"
            value={invitePassword}
            onChange={(event) => setInvitePassword(event.target.value)}
            placeholder="Contraseña *"
            className="h-11 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleInvite}
            disabled={inviting}
            className="px-5 h-11 bg-zinc-800 hover:bg-zinc-900 disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
          >
            {inviting && <Loader2 className="w-4 h-4 animate-spin" />} Crear empleado
          </button>
        </div>
        {lastCredentials && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-900">
            <p className="font-semibold mb-1">Credenciales creadas:</p>
            <p>Código: <strong>{lastCredentials.username || lastCredentials.email}</strong></p>
            <p>Contraseña: <strong>{lastCredentials.password}</strong></p>
          </div>
        )}
      </div>

      {profiles.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h2 className="font-semibold text-gray-900">Usuarios registrados ({profiles.length})</h2>
          <div className="space-y-2">
            {profiles.map((profile) => {
              const displayCode = profile.username && !profile.username.includes('@') ? profile.username : null
              const displayName = profile.username || profile.email?.split('@')[0] || '—'
              return (
                <div key={profile.id} className="flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-3 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {displayCode ? `Código: ${displayCode}` : profile.email}
                      {' · '}
                      <span className="capitalize">{ROLE_OPTIONS.find(r => r.value === profile.role)?.label || profile.role}</span>
                      {profile.store_name ? ` · ${profile.store_name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openEditModal(profile)}
                      title="Editar rol y negocio"
                      className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
                    >
                      <Users className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setPwModal(profile); setNewPassword('') }}
                      title="Cambiar contraseña"
                      className="p-2 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteUserModal(profile)}
                      title="Eliminar usuario"
                      className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Modal: editar rol y negocio ─────────────────────────────────────── */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest">Editar usuario</p>
                <h3 className="text-lg font-bold mt-0.5">{editModal.username || editModal.email}</h3>
              </div>
              <button onClick={() => setEditModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rol</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)}
                  className="mt-1 w-full h-10 px-3 border border-gray-200 rounded-lg text-sm">
                  {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {roleRequiresStore(editRole) && stores.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Negocio</label>
                  <select value={editStore} onChange={e => setEditStore(e.target.value)}
                    className="mt-1 w-full h-10 px-3 border border-gray-200 rounded-lg text-sm">
                    <option value="">Sin negocio asignado</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditModal(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSaveEdit} disabled={editSaving}
                className="flex-1 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
                {editSaving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: cambiar contraseña ───────────────────────────────────────── */}
      {pwModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest">Cambiar contraseña</p>
                <h3 className="text-lg font-bold mt-0.5">{pwModal.username || pwModal.email}</h3>
              </div>
              <button onClick={() => setPwModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSavePassword()}
              placeholder="Nueva contraseña (mín. 6 caracteres)"
              className="w-full h-11 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setPwModal(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSavePassword} disabled={pwSaving || !newPassword.trim()}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
                {pwSaving && <Loader2 className="w-4 h-4 animate-spin" />} Cambiar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: confirmar eliminar usuario ──────────────────────────────── */}
      {deleteUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest">Eliminar usuario</p>
              <h3 className="text-lg font-bold mt-0.5">{deleteUserModal.username || deleteUserModal.email}</h3>
              <p className="text-sm text-gray-500 mt-2">Esta acción es permanente. El usuario perderá acceso inmediatamente.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteUserModal(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleDeleteUser} disabled={deletingUser}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
                {deletingUser && <Loader2 className="w-4 h-4 animate-spin" />} Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Database className="w-4 h-4" /> Resumen de la base</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Productos', count: counts.products, color: 'bg-zinc-50 text-blue-700' },
            { label: 'Ventas', count: counts.sales, color: 'bg-zinc-50 text-blue-700' },
            { label: 'Compras', count: counts.purchases, color: 'bg-purple-50 text-purple-700' },
            { label: 'Gastos', count: counts.expenses, color: 'bg-amber-50 text-amber-700' },
          ].map(({ label, count, color }) => (
            <div key={label} className={`${color} rounded-xl p-3 text-center`}>
              <div className="text-xl font-bold">{count}</div>
              <div className="text-xs mt-1">{label}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3 text-center">Total: {totalRecords} registros</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Download className="w-4 h-4" /> Exportar base de datos</h2>
        <p className="text-sm text-gray-500 mb-4">Descargá un Excel con productos, ventas, compras y gastos.</p>
        <div className="bg-zinc-50 rounded-lg p-3 text-sm text-zinc-800 mb-4">
          El archivo contiene 4 hojas compatibles con Excel, Sheets y LibreOffice.
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-6 h-11 bg-zinc-800 hover:bg-zinc-900 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? 'Exportando...' : 'Descargar copia de seguridad'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h2 className="font-semibold text-red-700 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Zona peligrosa</h2>
        <p className="text-sm text-gray-500 mb-4">Esta acción elimina TODO registro.</p>
        <input
          value={deleteConfirm}
          onChange={(event) => setDeleteConfirm(event.target.value)}
          placeholder='Escribí "ELIMINAR TODO" para confirmar'
          className="w-full h-11 px-3 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 mb-3"
        />
        <button
          onClick={handleDeleteAll}
          disabled={deleting || deleteConfirm !== 'ELIMINAR TODO'}
          className="flex items-center gap-2 px-6 h-11 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-medium rounded-xl transition-colors"
        >
          {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Eliminar todos los datos
        </button>
      </div>
    </div>
  )
}
