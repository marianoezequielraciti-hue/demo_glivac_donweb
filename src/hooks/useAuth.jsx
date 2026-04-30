import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { isAdminRole, roleRequiresStore } from '@/lib/roles'

const ROLE_CACHE_KEY = 'glivac-demo-role-cache'
const CACHE_TTL_MS   = 24 * 60 * 60 * 1000

function getCached(userId) {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const stored = storage.getItem(ROLE_CACHE_KEY)
      if (!stored) continue
      const parsed = JSON.parse(stored)
      if (parsed.userId !== userId) continue
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) { storage.removeItem(ROLE_CACHE_KEY); continue }
      if (!('storeId' in parsed)) { storage.removeItem(ROLE_CACHE_KEY); continue }
      if (roleRequiresStore(parsed.role) && !parsed.storeId) { storage.removeItem(ROLE_CACHE_KEY); continue }
      return parsed
    } catch {}
  }
  return null
}

function setCache(userId, role, displayName, storeId = null, storeName = null) {
  const payload = JSON.stringify({ userId, role, displayName, storeId, storeName, expiresAt: Date.now() + CACHE_TTL_MS })
  try { localStorage.setItem(ROLE_CACHE_KEY, payload) } catch {}
  try { sessionStorage.setItem(ROLE_CACHE_KEY, payload) } catch {}
}

function clearCache() {
  try { localStorage.removeItem(ROLE_CACHE_KEY) } catch {}
  try { sessionStorage.removeItem(ROLE_CACHE_KEY) } catch {}
}

function emailToName(email) {
  if (!email) return 'Usuario'
  const first = email.split('@')[0].split(/[._0-9]/)[0]
  return first.charAt(0).toUpperCase() + first.slice(1)
}

// El user que viene del backend ya trae role/store_id/store_name
function buildProfile(apiUser) {
  const role        = apiUser.role       || 'employee'
  const displayName = apiUser.username   || emailToName(apiUser.email)
  const storeId     = apiUser.store_id   || null
  const storeName   = apiUser.store_name || null
  setCache(apiUser.id, role, displayName, storeId, storeName)
  return { role, displayName, storeId, storeName }
}

const AuthContext = createContext(null)

export default function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null)
  const [role,        setRole]        = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [storeId,     setStoreId]     = useState(null)
  const [storeName,   setStoreName]   = useState(null)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    let mounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return

        if (event === 'SIGNED_OUT' || !session?.user) {
          clearCache()
          setUser(null); setRole(null); setDisplayName(''); setStoreId(null); setStoreName(null)
          setLoading(false)
          return
        }

        const apiUser = session.user
        const cached  = getCached(apiUser.id)

        if (cached?.role) {
          setUser(apiUser)
          setRole(cached.role)
          setDisplayName(cached.displayName || emailToName(apiUser.email))
          setStoreId(cached.storeId || null)
          setStoreName(cached.storeName || null)
        } else {
          const profile = buildProfile(apiUser)
          setUser(apiUser)
          setRole(profile.role)
          setDisplayName(profile.displayName)
          setStoreId(profile.storeId)
          setStoreName(profile.storeName)
        }

        setLoading(false)
      }
    )

    return () => { mounted = false; subscription.unsubscribe() }
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
    () => ({ user, role, isAdmin: isAdminRole(role), displayName, storeId, storeName, loading, login, logout }),
    [user, role, displayName, storeId, storeName, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
