import { supabase } from '@/lib/supabase'

async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  const token    = data.session?.access_token
  if (!token) throw new Error('No hay sesión activa')
  return token
}

async function request(path, options = {}) {
  const token    = await getAccessToken()
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'No se pudo completar la solicitud')
  return payload
}

export function listAdminUsers()         { return request('/api/auth/users') }
export function createAdminUser(payload) { return request('/api/auth/users', { method: 'POST',   body: JSON.stringify(payload) }) }
export function updateAdminUser(payload) { return request(`/api/auth/users/${payload.userId || payload.id}`, { method: 'PATCH', body: JSON.stringify(payload) }) }
export function deleteAdminUser(id)      { return request(`/api/auth/users/${id}`,         { method: 'DELETE' }) }
