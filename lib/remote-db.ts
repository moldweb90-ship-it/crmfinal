type AnyRow = Record<string, any>

function ensureRows(input: AnyRow | AnyRow[]) {
  return Array.isArray(input) ? input : [input]
}

function emitChange() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('lifedental-local-db-change'))
}

class RemoteQuery {
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
    return this.execute({ field, value: String(value) })
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private async request(path: string, init?: RequestInit) {
    const response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    })
    const result = await response.json().catch(() => ({ data: null, error: 'Invalid server response' }))
    if (!response.ok) return { data: null, error: result.error || 'Database request failed' }
    return result
  }

  private async execute(filter?: { field: string; value: string }) {
    const params = new URLSearchParams()
    if (this.orderField) params.set('orderField', this.orderField)
    params.set('ascending', String(this.ascending))
    if (filter) {
      params.set('eqField', filter.field)
      params.set('eqValue', filter.value)
    }

    const query = params.toString()
    const url = `/api/db/${this.table}${query ? `?${query}` : ''}`

    if (this.action === 'insert') {
      const result = await this.request(`/api/db/${this.table}`, {
        method: 'POST',
        body: JSON.stringify({ rows: ensureRows(this.payload) }),
      })
      emitChange()
      return { data: this.shouldReturnRows ? result.data : null, error: result.error }
    }

    if (this.action === 'update') {
      const result = await this.request(url, {
        method: 'PATCH',
        body: JSON.stringify({ values: this.payload, filter }),
      })
      emitChange()
      return { data: this.shouldReturnRows ? result.data : null, error: result.error }
    }

    if (this.action === 'delete') {
      const result = await this.request(url, { method: 'DELETE' })
      emitChange()
      return { data: this.shouldReturnRows ? result.data : null, error: result.error }
    }

    return this.request(url)
  }
}

export const remoteDb = {
  from(table: string) {
    return new RemoteQuery(table)
  },
}
