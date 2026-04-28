const STORAGE_KEY = 'glivac-demo-promotions'

const readStorage = () => {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

const writeStorage = (promotions) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(promotions))
  window.dispatchEvent(new Event('glivac-demo-promotions'))
}

export const loadPromotions = () => readStorage()

export const addPromotion = (promotion) => {
  const existing = readStorage()
  const alreadyExists = existing.some(p => p.name === promotion.name)
  if (alreadyExists) return false
  existing.push({ id: Date.now().toString(), ...promotion })
  writeStorage(existing)
  return true
}

export const clearPromotions = () => {
  writeStorage([])
}
