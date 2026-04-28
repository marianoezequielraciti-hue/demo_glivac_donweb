export const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner', admin: true, requiresStore: false },
  { value: 'admin', label: 'Administrador', admin: true, requiresStore: false },
  { value: 'manager', label: 'Encargado', admin: false, requiresStore: true },
  { value: 'cashier', label: 'Cajero', admin: false, requiresStore: true },
  { value: 'inventory', label: 'Stock', admin: false, requiresStore: true },
  { value: 'analyst', label: 'Analista', admin: false, requiresStore: true },
  { value: 'employee', label: 'Empleado', admin: false, requiresStore: true },
]

const ROLE_MAP = new Map(ROLE_OPTIONS.map((role) => [role.value, role]))
const ADMIN_ROLES = new Set(ROLE_OPTIONS.filter((role) => role.admin).map((role) => role.value))

export function getRoleOption(role) {
  return ROLE_MAP.get(role) || ROLE_MAP.get('employee')
}

export function isAdminRole(role) {
  return ADMIN_ROLES.has(role)
}

export function roleRequiresStore(role) {
  return getRoleOption(role).requiresStore
}

export function getDefaultRoleForDemo() {
  return 'cashier'
}
