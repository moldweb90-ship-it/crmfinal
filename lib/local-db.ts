type AnyRow = Record<string, any>
type Store = Record<string, AnyRow[]>

const STORAGE_KEY = 'lifedental_crm_local_db_v1'
let cachedStore: Store | null = null

const seed: Store = {
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
  doctors: [
    {
      id: 'doctor-therapy',
      full_name: 'Д-р Анна Миронова',
      specialization: 'Терапевт',
      phone: '+373 60 100 101',
      email: 'anna@lifedental.local',
      bio: 'Лечение кариеса, консультации и профилактика.',
      photo_url: '',
      color_code: '#2563eb',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'doctor-ortho',
      full_name: 'Д-р Виктор Русу',
      specialization: 'Ортодонт',
      phone: '+373 60 100 102',
      email: 'victor@lifedental.local',
      bio: 'Брекеты, элайнеры, ортодонтические планы.',
      photo_url: '',
      color_code: '#10b981',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  services: [
    {
      id: 'service-consultation',
      name: 'Консультация',
      description: 'Первичный осмотр и план рекомендаций.',
      price: 300,
      duration_minutes: 45,
      color_code: '#2563eb',
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'service-cleaning',
      name: 'Профессиональная чистка',
      description: 'Гигиена, снятие налета и полировка.',
      price: 850,
      duration_minutes: 60,
      color_code: '#10b981',
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ],
  patients: [],
  leads: [],
  appointments: [],
  tasks: [],
  contact_history: [],
  treatment_plans: [],
  payments: [],
  work_shifts: [],
  profiles: [],
  managers: [
    {
      id: 'manager-main',
      full_name: 'Менеджер',
      email: 'manager@lifedental.local',
      phone: '+373 69 000 000',
      role: 'manager',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  jivo_conversations: [
    {
      id: 'jivo-demo-1',
      jivo_chat_id: 'JD-1001',
      channel: 'instagram',
      source: 'Instagram',
      manager_id: 'manager-main',
      manager_name: 'Менеджер',
      client_name: 'Ирина',
      client_phone: '+373 69 214 001',
      status: 'finished',
      started_at: new Date(new Date().setHours(9, 12, 0, 0)).toISOString(),
      accepted_at: new Date(new Date().setHours(9, 13, 0, 0)).toISOString(),
      first_response_at: new Date(new Date().setHours(9, 14, 20, 0)).toISOString(),
      finished_at: new Date(new Date().setHours(9, 28, 0, 0)).toISOString(),
      response_seconds: 80,
      messages_count: 14,
      calls_count: 1,
      consultation_count: 1,
      appointment_created: true,
      sale_closed: true,
      sale_amount: 1800,
      lead_id: null,
      patient_id: null,
      raw_payload: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'jivo-demo-2',
      jivo_chat_id: 'JD-1002',
      channel: 'whatsapp',
      source: 'WhatsApp',
      manager_id: 'manager-main',
      manager_name: 'Менеджер',
      client_name: 'Андрей',
      client_phone: '+373 78 580 111',
      status: 'finished',
      started_at: new Date(new Date().setHours(11, 5, 0, 0)).toISOString(),
      accepted_at: new Date(new Date().setHours(11, 6, 0, 0)).toISOString(),
      first_response_at: new Date(new Date().setHours(11, 7, 45, 0)).toISOString(),
      finished_at: new Date(new Date().setHours(11, 34, 0, 0)).toISOString(),
      response_seconds: 105,
      messages_count: 21,
      calls_count: 0,
      consultation_count: 1,
      appointment_created: true,
      sale_closed: false,
      sale_amount: 0,
      lead_id: null,
      patient_id: null,
      raw_payload: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'jivo-demo-3',
      jivo_chat_id: 'JD-1003',
      channel: 'facebook',
      source: 'Facebook',
      manager_id: 'manager-main',
      manager_name: 'Менеджер',
      client_name: 'Марина',
      client_phone: '',
      status: 'missed',
      started_at: new Date(new Date().setHours(14, 40, 0, 0)).toISOString(),
      accepted_at: null,
      first_response_at: null,
      finished_at: new Date(new Date().setHours(14, 55, 0, 0)).toISOString(),
      response_seconds: null,
      messages_count: 2,
      calls_count: 0,
      consultation_count: 0,
      appointment_created: false,
      sale_closed: false,
      sale_amount: 0,
      lead_id: null,
      patient_id: null,
      raw_payload: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  jivo_events: [],
  manager_kpi_targets: [
    {
      id: 'target-main',
      manager_id: 'manager-main',
      new_leads: 12,
      avg_response_seconds: 120,
      calls: 8,
      consultations: 5,
      appointments: 4,
      closed_sales: 2,
      sales_amount: 5000,
      conversion_percent: 30,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  google_calendar_sources: [
    {
      id: 'gcal-source-botanica',
      name: 'Google Calendar - Botanica',
      calendar_id: 'botanica@example.com',
      doctor_id: 'doctor-therapy',
      clinic_id: 'clinic-zelinski',
      color_code: '#4285f4',
      sync_mode: 'read_only',
      is_active: true,
      last_synced_at: null,
      sync_token: null,
      ical_url: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'gcal-source-chekany',
      name: 'Google Calendar - Chekany',
      calendar_id: 'chekany@example.com',
      doctor_id: 'doctor-ortho',
      clinic_id: 'clinic-russo',
      color_code: '#34a853',
      sync_mode: 'read_only',
      is_active: true,
      last_synced_at: null,
      sync_token: null,
      ical_url: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  google_calendar_events: [
    {
      id: 'gcal-event-demo-1',
      source_id: 'gcal-source-botanica',
      google_event_id: 'demo-botanica-1',
      calendar_id: 'botanica@example.com',
      doctor_id: 'doctor-therapy',
      clinic_id: 'clinic-zelinski',
      patient_name: 'Пациент из Google',
      service_name: 'Консультация',
      description: 'Импортировано из Google Calendar. Можно связать с пациентом в CRM.',
      location: 'ул. Николай Зелинский, 35',
      start_time: new Date(new Date().setHours(12, 30, 0, 0)).toISOString(),
      end_time: new Date(new Date().setHours(13, 30, 0, 0)).toISOString(),
      status: 'confirmed',
      html_link: '',
      raw_payload: null,
      last_seen_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
}

const tables = Object.keys(seed)

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
