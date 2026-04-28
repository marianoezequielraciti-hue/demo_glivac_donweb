import { createClient } from '@supabase/supabase-js'
import { isAdminRole } from './roles.js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function assertEnv(value, name) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function createPublicServerClient() {
  return createClient(
    assertEnv(supabaseUrl, 'SUPABASE_URL or VITE_SUPABASE_URL'),
    assertEnv(supabaseAnonKey, 'SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY')
  )
}

export function createAdminServerClient() {
  return createClient(
    assertEnv(supabaseUrl, 'SUPABASE_URL or VITE_SUPABASE_URL'),
    assertEnv(supabaseServiceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || ''
  if (!header.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length)
}

export async function requireAdmin(req) {
  const token = getBearerToken(req)
  if (!token) {
    return { error: { status: 401, message: 'Missing bearer token' } }
  }

  const publicClient = createPublicServerClient()
  const adminClient = createAdminServerClient()

  const {
    data: { user },
    error: authError,
  } = await publicClient.auth.getUser(token)

  if (authError || !user) {
    return { error: { status: 401, message: 'Invalid session token' } }
  }

  const { data: profile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !isAdminRole(profile?.role)) {
    return { error: { status: 403, message: 'Admin access required' } }
  }

  return { adminClient, requester: user }
}

export function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8')
  res.send(JSON.stringify(body))
}

export function generateTemporaryPassword() {
  return `Demo${Math.random().toString(36).slice(2, 8)}!9`
}
