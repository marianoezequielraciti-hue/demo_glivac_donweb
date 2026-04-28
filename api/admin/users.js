import { generateTemporaryPassword, requireAdmin, sendJson } from '../_lib/supabaseAdmin.js'
import { isKnownRole, roleRequiresStore } from '../_lib/roles.js'

async function listUsers(adminClient, res) {
  const { data, error } = await adminClient
    .from('user_profiles')
    .select('id, email, role, username, store_id, created_at, stores(name)')
    .order('created_at', { ascending: false })

  if (error) {
    return sendJson(res, 500, { error: error.message })
  }

  return sendJson(res, 200, {
    users: (data || []).map((profile) => ({
      ...profile,
      store_name: profile.stores?.name || null,
    })),
  })
}

async function createUser(adminClient, req, res) {
  const {
    email,
    role = 'cashier',
    username = '',
    storeId = null,
    sendInvite = false,
    password,
  } = req.body || {}

  if (!email?.trim()) {
    return sendJson(res, 400, { error: 'Email is required' })
  }

  if (!isKnownRole(role)) {
    return sendJson(res, 400, { error: 'Invalid role' })
  }
  if (roleRequiresStore(role) && !storeId) {
    return sendJson(res, 400, { error: 'storeId is required for this role' })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const normalizedUsername = username.trim()
  const temporaryPassword = password?.trim() || generateTemporaryPassword()

  let userId = null

  if (sendInvite) {
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(normalizedEmail)
    if (error) {
      return sendJson(res, 400, { error: error.message })
    }
    userId = data?.user?.id
  } else {
    const { data, error } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: normalizedUsername ? { username: normalizedUsername } : undefined,
    })
    if (error) {
      return sendJson(res, 400, { error: error.message })
    }
    userId = data?.user?.id
  }

  if (!userId) {
    return sendJson(res, 500, { error: 'Could not create the auth user' })
  }

  const payload = {
    id: userId,
    email: normalizedEmail,
    role,
    username: normalizedUsername || null,
    store_id: roleRequiresStore(role) ? (storeId || null) : null,
  }

  const { error: profileError } = await adminClient
    .from('user_profiles')
    .upsert(payload, { onConflict: 'id' })

  if (profileError) {
    return sendJson(res, 400, { error: profileError.message })
  }

  return sendJson(res, 201, {
    user: payload,
    credentials: sendInvite ? null : { email: normalizedEmail, password: temporaryPassword },
  })
}

async function updateUser(adminClient, req, res) {
  const { userId, role, storeId, username } = req.body || {}

  if (!userId) {
    return sendJson(res, 400, { error: 'userId is required' })
  }

  const updates = {}
  if (role) {
    if (!isKnownRole(role)) {
      return sendJson(res, 400, { error: 'Invalid role' })
    }
    updates.role = role
    if (!roleRequiresStore(role)) {
      updates.store_id = null
    }
  }
  if (typeof storeId !== 'undefined') {
    const effectiveRole = role || null
    if (effectiveRole && roleRequiresStore(effectiveRole) && !storeId) {
      return sendJson(res, 400, { error: 'storeId is required for this role' })
    }
    updates.store_id = storeId || null
  }
  if (typeof username !== 'undefined') {
    updates.username = username?.trim() || null
  }

  const { data, error } = await adminClient
    .from('user_profiles')
    .update(updates)
    .eq('id', userId)
    .select('id, email, role, username, store_id, created_at')
    .single()

  if (error) {
    return sendJson(res, 400, { error: error.message })
  }

  return sendJson(res, 200, { user: data })
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const auth = await requireAdmin(req)
  if (auth.error) {
    sendJson(res, auth.error.status, { error: auth.error.message })
    return
  }

  const { adminClient } = auth

  if (req.method === 'GET') {
    return listUsers(adminClient, res)
  }
  if (req.method === 'POST') {
    return createUser(adminClient, req, res)
  }
  if (req.method === 'PATCH') {
    return updateUser(adminClient, req, res)
  }

  sendJson(res, 405, { error: 'Method not allowed' })
}
