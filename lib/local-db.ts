type AnyRow = Record<string, any>
type Store = Record<string, AnyRow[]>

const STORAGE_KEY = 'lifedental_crm_local_db_v1'
let cachedStore: Store | null = null

export const seed: Store = {
  clinics: [
    {
      id: 'clinic-zelinski',
      name: 'LIFE DENTAL Zelinski',
      phone: '+373 69 214 434',
      address: 'г. Кишинёв, ул. Николай Зелинский, 35',
      city: 'Кишинёв',
      color_code: '#14b8a6',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'clinic-russo',
      name: 'LIFE DENTAL Russo',
      phone: '+373 78 580 028',
      address: 'г. Кишинёв, ул. Алеку Руссо 57/2',
      city: 'Кишинёв',
      color_code: '#38bdf8',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  doctors: [],
  services: [],
  patients: [],
  leads: [],
  appointments: [],
  tasks: [],
  contact_history: [],
  treatment_plans: [],
  payments: [],
  work_shifts: [],
  profiles: [],
  managers: [],
  jivo_conversations: [],
  jivo_events: [],
  manager_kpi_targets: [],
  google_calendar_sources: [],
  google_calendar_events: [],
}

export const tables = Object.keys(seed)

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `local_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function normalizeStore(store: Partial<Store>): Store {
  const next: Store = {}
  for (const table of tables) next[table] = Array.isArray(store[table]) ? store[table]! : clone(seed[table])
  return next
}

function readStore(): Store {
  if (cachedStore) return cachedStore
  if (!canUseStorage()) {
    cachedStore = normalizeStore({})
    return cachedStore
  }
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const initial = normalizeStore(seed)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
    cachedStore = initial
    return initial
  }
  try {
    cachedStore = normalizeStore(JSON.parse(raw))
    return cachedStore
  } catch {
    const initial = normalizeStore(seed)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
    cachedStore = initial
    return initial
  }
}

function writeStore(store: Store) {
  cachedStore = store
  if (!canUseStorage()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  window.dispatchEvent(new CustomEvent('lifedental-local-db-change'))
}

function ensureRows(input: AnyRow | AnyRow[]) {
  return Array.isArray(input) ? input : [input]
}

class LocalQuery {
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private payload: any
  private orderField: string | null = null
  private ascending = true
  private shouldReturnRows = false

  constructor(private table: string) {}

  select(_columns = '*') {
    this.shouldReturnRows = true
    return this
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderField = field
    this.ascending = options?.ascending ?? true
    return this
  }

  insert(rows: AnyRow | AnyRow[]) {
    this.action = 'insert'
    this.payload = rows
    return this
  }

  update(values: AnyRow) {
    this.action = 'update'
    this.payload = values
    return this
  }

  delete() {
    this.action = 'delete'
    return this
  }

  async eq(field: string, value: any) {
    return this.execute({ field, value })
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private async execute(filter?: { field: string; value: any }) {
    try {
      const store = readStore()
      if (!store[this.table]) store[this.table] = []

      if (this.action === 'insert') {
        const now = new Date().toISOString()
        const inserted = ensureRows(this.payload).map((row) => ({
          id: row.id || makeId(),
          created_at: row.created_at || now,
          updated_at: row.updated_at || now,
          ...row,
        }))
        store[this.table] = [...store[this.table], ...inserted]
        writeStore(store)
        return { data: this.shouldReturnRows ? clone(inserted) : null, error: null }
      }

      if (this.action === 'update') {
        const updated: AnyRow[] = []
        store[this.table] = store[this.table].map((row) => {
          if (!filter || row[filter.field] !== filter.value) return row
          const next = { ...row, ...this.payload, updated_at: new Date().toISOString() }
          updated.push(next)
          return next
        })
        writeStore(store)
        return { data: this.shouldReturnRows ? clone(updated) : null, error: null }
      }

      if (this.action === 'delete') {
        const removed = store[this.table].filter((row) => !filter || row[filter.field] === filter.value)
        store[this.table] = store[this.table].filter((row) => filter && row[filter.field] !== filter.value)
        writeStore(store)
        return { data: this.shouldReturnRows ? clone(removed) : null, error: null }
      }

      let rows = [...store[this.table]]
      if (filter) rows = rows.filter((row) => row[filter.field] === filter.value)
      if (this.orderField) {
        rows.sort((a, b) => {
          const left = a[this.orderField!]
          const right = b[this.orderField!]
          if (left === right) return 0
          if (left == null) return 1
          if (right == null) return -1
          return (left > right ? 1 : -1) * (this.ascending ? 1 : -1)
        })
      }
      return { data: clone(rows), error: null }
    } catch (error) {
      return { data: null, error }
    }
  }
}

export const localDb = {
  from(table: string) {
    return new LocalQuery(table)
  },
  reset() {
    if (!canUseStorage()) return
    cachedStore = normalizeStore(seed)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedStore))
    window.dispatchEvent(new CustomEvent('lifedental-local-db-change'))
  },
}
