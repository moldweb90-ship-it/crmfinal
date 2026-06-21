import { Pool } from 'pg'
import { seed, tables } from './local-db'

type AnyRow = Record<string, any>
type TableName = (typeof tables)[number]

const tableSet = new Set(tables)
const safeField = /^[a-zA-Z0-9_]+$/
const metaFields = new Set(['id', 'created_at', 'updated_at'])

let pool: Pool | null = null
let initialized = false

function getPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured')
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  }

  return pool
}

function assertTable(table: string): asserts table is TableName {
  if (!tableSet.has(table)) throw new Error(`Unknown CRM table: ${table}`)
}

function dbTable(table: string) {
  assertTable(table)
  return `crm_${table}`
}

function toData(row: AnyRow) {
  const { id, created_at, updated_at, ...data } = row
  return data
}

function fromRecord(record: AnyRow) {
  return {
    id: record.id,
    created_at: record.created_at instanceof Date ? record.created_at.toISOString() : record.created_at,
    updated_at: record.updated_at instanceof Date ? record.updated_at.toISOString() : record.updated_at,
    ...(record.data || {}),
  }
}

function ensureRows(rows: AnyRow | AnyRow[]) {
  return Array.isArray(rows) ? rows : [rows]
}

function makeId() {
  return crypto.randomUUID()
}

function orderExpression(field?: string | null) {
  const key = field || 'created_at'
  if (!safeField.test(key)) return 'created_at'
  if (metaFields.has(key)) return key
  return `(data->>'${key}')`
}

async function ensureSchema() {
  if (initialized) return
  const client = await getPool().connect()

  try {
    await client.query('BEGIN')

    for (const table of tables) {
      const name = dbTable(table)
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${name} (
          id text PRIMARY KEY,
          data jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `)
      await client.query(`CREATE INDEX IF NOT EXISTS ${name}_data_gin ON ${name} USING gin (data)`)
      await client.query(`CREATE INDEX IF NOT EXISTS ${name}_created_at_idx ON ${name} (created_at DESC)`)

      const { rows } = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${name}`)
      if (Number(rows[0]?.count || 0) === 0 && seed[table]?.length) {
        for (const row of seed[table]) {
          await client.query(
            `INSERT INTO ${name} (id, data, created_at, updated_at) VALUES ($1, $2::jsonb, $3, $4) ON CONFLICT (id) DO NOTHING`,
            [
              row.id || makeId(),
              JSON.stringify(toData(row)),
              row.created_at || new Date().toISOString(),
              row.updated_at || row.created_at || new Date().toISOString(),
            ],
          )
        }
      }
    }

    await client.query('COMMIT')
    initialized = true
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function selectRows(table: string, options?: {
  eqField?: string | null
  eqValue?: string | null
  orderField?: string | null
  ascending?: boolean
}) {
  await ensureSchema()

  const name = dbTable(table)
  const order = orderExpression(options?.orderField)
  const direction = options?.ascending ? 'ASC' : 'DESC'
  const params: any[] = []
  let where = ''

  if (options?.eqField && options.eqValue != null && safeField.test(options.eqField)) {
    params.push(options.eqValue)
    where = options.eqField === 'id'
      ? `WHERE id = $1`
      : `WHERE data->>'${options.eqField}' = $1`
  }

  const { rows } = await getPool().query(
    `SELECT id, data, created_at, updated_at FROM ${name} ${where} ORDER BY ${order} ${direction}`,
    params,
  )

  return rows.map(fromRecord)
}

export async function insertRows(table: string, input: AnyRow | AnyRow[]) {
  await ensureSchema()

  const name = dbTable(table)
  const now = new Date().toISOString()
  const inserted: AnyRow[] = []

  for (const row of ensureRows(input)) {
    const id = row.id || makeId()
    const createdAt = row.created_at || now
    const updatedAt = row.updated_at || now
    const data = toData({ ...row, id, created_at: createdAt, updated_at: updatedAt })

    const { rows } = await getPool().query(
      `INSERT INTO ${name} (id, data, created_at, updated_at)
       VALUES ($1, $2::jsonb, $3, $4)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
       RETURNING id, data, created_at, updated_at`,
      [id, JSON.stringify(data), createdAt, updatedAt],
    )
    inserted.push(fromRecord(rows[0]))
  }

  return inserted
}

export async function updateRows(table: string, values: AnyRow, filter?: { field: string; value: string }) {
  await ensureSchema()

  const name = dbTable(table)
  const now = new Date().toISOString()
  const data = toData(values)
  const params: any[] = [JSON.stringify(data), now]
  let where = ''

  if (filter?.field && safeField.test(filter.field)) {
    params.push(filter.value)
    where = filter.field === 'id'
      ? `WHERE id = $3`
      : `WHERE data->>'${filter.field}' = $3`
  }

  const { rows } = await getPool().query(
    `UPDATE ${name}
     SET data = data || $1::jsonb, updated_at = $2
     ${where}
     RETURNING id, data, created_at, updated_at`,
    params,
  )

  return rows.map(fromRecord)
}

export async function deleteRows(table: string, filter?: { field: string; value: string }) {
  await ensureSchema()

  const name = dbTable(table)
  const params: any[] = []
  let where = ''

  if (filter?.field && safeField.test(filter.field)) {
    params.push(filter.value)
    where = filter.field === 'id'
      ? `WHERE id = $1`
      : `WHERE data->>'${filter.field}' = $1`
  }

  const { rows } = await getPool().query(
    `DELETE FROM ${name} ${where} RETURNING id, data, created_at, updated_at`,
    params,
  )

  return rows.map(fromRecord)
}

export async function upsertJivoEvent(eventName: string, conversation: AnyRow, payload: AnyRow) {
  await ensureSchema()

  const event = await insertRows('jivo_events', [{
    event_name: eventName,
    jivo_chat_id: conversation.jivo_chat_id,
    payload,
    created_at: new Date().toISOString(),
  }])

  const shouldCreateConversation = Boolean(conversation.jivo_chat_id)
    || ['offline_message', 'chat_started', 'chat_accepted', 'chat_finished', 'chat_missed'].includes(eventName || '')

  if (!shouldCreateConversation) {
    return {
      event: event[0],
      conversation: null,
    }
  }

  const existingByChat = conversation.jivo_chat_id
    ? await selectRows('jivo_conversations', { eqField: 'jivo_chat_id', eqValue: conversation.jivo_chat_id, orderField: 'created_at', ascending: false })
    : []

  const existingByClient = existingByChat.length || !conversation.jivo_client_id
    ? []
    : await selectRows('jivo_conversations', { eqField: 'jivo_client_id', eqValue: conversation.jivo_client_id, orderField: 'created_at', ascending: false })

  const existing = existingByChat[0] || existingByClient[0]
  const genericManager = !conversation.manager_name || conversation.manager_name === 'Jivo operator'
  const mergedConversation = existing
    ? {
        ...existing,
        ...conversation,
        manager_id: genericManager ? existing.manager_id : conversation.manager_id,
        manager_name: genericManager ? existing.manager_name : conversation.manager_name,
        status: conversation.status || existing.status,
        last_event_at: conversation.last_event_at || existing.last_event_at,
        accepted_at: conversation.accepted_at || existing.accepted_at,
        first_response_at: conversation.first_response_at || existing.first_response_at,
        response_seconds: conversation.response_seconds ?? existing.response_seconds,
        wait_seconds: conversation.wait_seconds ?? existing.wait_seconds,
        accept_seconds: conversation.accept_seconds ?? existing.accept_seconds,
        abandoned: Boolean(conversation.abandoned ?? existing.abandoned),
        late_response: Boolean(existing.late_response || conversation.late_response),
        response_sla_seconds: conversation.response_sla_seconds ?? existing.response_sla_seconds,
        messages_count: Math.max(Number(existing.messages_count || 0), Number(conversation.messages_count || 0)),
        calls_count: Math.max(Number(existing.calls_count || 0), Number(conversation.calls_count || 0)),
        consultation_count: Math.max(Number(existing.consultation_count || 0), Number(conversation.consultation_count || 0)),
        appointment_created: Boolean(existing.appointment_created || conversation.appointment_created),
        sale_closed: Boolean(existing.sale_closed || conversation.sale_closed),
        sale_amount: Math.max(Number(existing.sale_amount || 0), Number(conversation.sale_amount || 0)),
        raw_payload: conversation.raw_payload,
      }
    : conversation

  const savedConversation = existing
    ? await updateRows('jivo_conversations', mergedConversation, { field: 'id', value: existing.id })
    : await insertRows('jivo_conversations', [mergedConversation])

  return {
    event: event[0],
    conversation: savedConversation[0],
  }
}
