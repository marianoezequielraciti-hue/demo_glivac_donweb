export const ROLE_OPTIONS = [
  { value: 'owner', admin: true, requiresStore: false },
  { value: 'admin', admin: true, requiresStore: false },
  { value: 'manager', admin: false, requiresStore: true },
  { value: 'cashier', admin: false, requiresStore: true },
  { value: 'inventory', admin: false, requiresStore: true },
  { value: 'analyst', admin: false, requiresStore: true },
  { value: 'employee', admin: false, requiresStore: true },
]

const ROLE_MAP = new Map(ROLE_OPTIONS.map((role) => [role.value, role]))

export function isKnownRole(role) {
  return ROLE_MAP.has(role)
}

export function isAdminRole(role) {
  return ROLE_MAP.get(role)?.admin || false
}

export function roleRequiresStore(role) {
  return ROLE_MAP.get(role)?.requiresStore || false
}
