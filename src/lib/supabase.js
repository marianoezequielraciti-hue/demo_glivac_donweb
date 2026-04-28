import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

export const db = {
  products:  () => supabase.from('products'),
  sales:     () => supabase.from('sales'),
  expenses:  () => supabase.from('expenses'),
  purchases: () => supabase.from('purchases'),
}

/*
-- Ejecutar en Supabase SQL Editor si el frontend no puede leer datos:

create policy if not exists "productos_select_autenticados" on products
  for select using (auth.role() = 'authenticated');

create policy if not exists "productos_escritura_admin" on products
  for all using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );
*/
