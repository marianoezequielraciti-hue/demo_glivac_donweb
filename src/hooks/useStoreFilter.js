import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

const STORAGE_KEY = 'selectedStoreId'

export function useStoreFilter() {
  const { user, isAdmin, storeId } = useAuth()

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data } = await supabase.from('stores').select('id, name, type, active').order('name')
      return data || []
    },
    enabled: !!user,
  })

  const getInitial = () => {
    if (!isAdmin) return storeId || null
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(STORAGE_KEY) || null
  }

  // Auto-select the only store when there's just one
  useEffect(() => {
    if (stores.length === 1 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id)
    }
  }, [stores])

  const [selectedStoreId, setSelectedStoreId] = useState(getInitial)

  useEffect(() => {
    if (!isAdmin) {
      setSelectedStoreId(storeId || null)
    }
  }, [isAdmin, storeId])

  useEffect(() => {
    if (!isAdmin || typeof window === 'undefined') return
    if (selectedStoreId) {
      window.localStorage.setItem(STORAGE_KEY, selectedStoreId)
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [isAdmin, selectedStoreId])

  const controlledSet = (value) => {
    if (!isAdmin) return
    setSelectedStoreId(value || null)
  }

  const currentStore = useMemo(() => stores.find(store => store.id === selectedStoreId) || null, [stores, selectedStoreId])

  return {
    stores,
    selectedStoreId,
    setSelectedStoreId: controlledSet,
    currentStore,
    isAdmin,
  }
}
