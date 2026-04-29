import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getDefaultRoleForDemo, isAdminRole, roleRequiresStore } from '@/lib/roles'

const ADMIN_EMAILS = (import.meta.env.VITE_SUPABASE_ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

const isAdminEmail = (email) => {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

const ROLE_CACHE_KEY = 'glivac-demo-role-cache'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function getCached(userId) {
  // Try localStorage first (persists across tabs), fallback to sessionStorage
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const stored = storage.getItem(ROLE_CACHE_KEY)
      if (!stored) continue
      const parsed = JSON.parse(stored)
      if (parsed.userId !== userId) continue
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        storage.removeItem(ROLE_CACHE_KEY)
        continue
      }
      // Invalidate cache if missing storeId or if role is a non-admin fallback
      if (!('storeId' in parsed) || parsed.role === 'cashier') {
        storage.removeItem(ROLE_CACHE_KEY)
        continue
      }
      // Empleado con storeId null en cache — puede haberse asignado desde entonces
      if (roleRequiresStore(parsed.role) && !parsed.storeId) {
        storage.removeItem(ROLE_CACHE_KEY)
        continue
      }
      return parsed
    } catch {}
  }
  return null
}

function setCache(userId, role, displayName, storeId = null, storeName = null) {
  const payload = JSON.stringify({
    userId, role, displayName, storeId, storeName,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
  try { localStorage.setItem(ROLE_CACHE_KEY, payload) } catch {}
  try { sessionStorage.setItem(ROLE_CACHE_KEY, payload) } catch {}
}

function clearCache() {
  try { localStorage.removeItem(ROLE_CACHE_KEY) } catch {}
  try { sessionStorage.removeItem(ROLE_CACHE_KEY) } catch {}
}

function emailToName(email) {
  if (!email) return 'Usuario'
  const local = email.split('@')[0]
  // capitalize first segment before dot or number
  const first = local.split(/[._0-9]/)[0]
  return first.charAt(0).toUpperCase() + first.slice(1)
}

async function resolveProfile(userId, email) {
  const cached = getCached(userId)
  if (cached?.role) return {
    role: cached.role,
    displayName: cached.displayName || emailToName(email),
    storeId: cached.storeId || null,
    storeName: cached.storeName || null,
  }

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('role, store_id, stores(name)')
      .eq('id', userId)
      .single()
    if (!error && data?.role) {
      const displayName = emailToName(email)
      const storeId = data.store_id || null
      const storeName = data.stores?.name || null
      setCache(userId, data.role, displayName, storeId, storeName)
      return { role: data.role, displayName, storeId, storeName }
    }
  } catch {}

  const role = isAdminEmail(email) ? 'admin' : getDefaultRoleForDemo()
  const displayName = emailToName(email)
  setCache(userId, role, displayName, null, null)
  return { role, displayName, storeId: null, storeName: null }
}

const AuthContext = createContext(null)

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [storeId, setStoreId] = useState(null)
  const [storeName, setStoreName] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (event === 'SIGNED_OUT') {
          clearCache()
          setUser(null)
          setRole(null)
          setDisplayName('')
          setStoreId(null)
          setStoreName(null)
          setLoading(false)
          return
        }

        if (session?.user) {
          // On token refresh, user is already in state — just refresh profile data
          if (event === 'TOKEN_REFRESHED') {
            const cached = getCached(session.user.id)
            if (cached?.role) {
              setRole(cached.role)
              setDisplayName(cached.displayName || emailToName(session.user.email))
              setStoreId(cached.storeId || null)
              setStoreName(cached.storeName || null)
              setLoading(false)
              return
            }
          }

          // Resolver perfil ANTES de setUser para que cuando las queries
          // se activen (enabled: !!user), storeId ya esté disponible
          const profile = await resolveProfile(session.user.id, session.user.email)
          if (mounted) {
            setUser(session.user)
            setRole(profile.role)
            setDisplayName(profile.displayName)
            setStoreId(profile.storeId)
            setStoreName(profile.storeName)
          }
        } else {
          clearCache()
          setUser(null)
          setRole(null)
          setDisplayName('')
          setStoreId(null)
          setStoreName(null)
        }

        if (mounted) setLoading(false)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }

  const logout = async () => {
    clearCache()
    await supabase.auth.signOut()
  }

  const value = useMemo(
    () => ({
      user,
      role,
      isAdmin: isAdminRole(role),
      displayName,
      storeId,
      storeName,
      loading,
      login,
      logout,
    }),
    [user, role, displayName, storeId, storeName, loading]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
