import { NextRequest, NextResponse } from 'next/server'
import { upsertJivoEvent } from '@/lib/server-db'

function secondsBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return null
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  return Number.isFinite(diff) && diff >= 0 ? diff : null
}

const JIVO_RESPONSE_SLA_SECONDS = 120

function toIsoDate(value?: string | number | null) {
  if (!value) return null
  const date = typeof value === 'number'
    ? new Date(value < 10000000000 ? value * 1000 : value)
    : new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function firstMessageAt(messages: any[], type?: string) {
  const message = messages.find((item) => !type || item?.type === type)
  return toIsoDate(message?.timestamp)
}

function normalizeChannel(value?: string | null) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return 'website'
  if (raw.includes('instagram')) return 'instagram'
  if (raw.includes('facebook') || raw === 'fb') return 'facebook'
  if (raw.includes('whatsapp') || raw === 'wa') return 'whatsapp'
  if (raw.includes('telegram')) return 'telegram'
  if (raw.includes('phone') || raw.includes('call')) return 'phone'
  if (raw.includes('offline')) return 'offline'

  // Jivo often sends widget IDs here. They are useful technically, but unreadable
  // for managers, so the CRM treats them as site chats.
  if (/^[a-z0-9_-]{8,}$/i.test(raw)) return 'website'
  return 'other'
}

function normalizeStatus(eventName: string, event: any) {
  const raw = String(event?.status || '').toLowerCase()
  const name = eventName.toLowerCase()
  if (name.includes('missed') || name.includes('offline') || raw.includes('missed')) return 'missed'
  if (name.includes('finished') || name.includes('closed') || raw.includes('finished') || raw.includes('closed')) return 'finished'
  if (name.includes('accepted') || raw.includes('accepted')) return 'answered'
  return 'active'
}

function normalizeJivoPayload(payload: any) {
  const eventName = payload?.event_name || payload?.event?.event_name || payload?.event_type || 'unknown'
  const event = payload?.event || payload
  const visitor = event?.visitor || payload?.visitor || {}
  const agent = event?.agent || event?.assigned_agent || payload?.agent || payload?.assigned_agent || event?.agents?.[0] || payload?.agents?.[0] || {}
  const chatId = event?.chat_id || payload?.chat_id || event?.chat?.id || payload?.chat?.id || event?.dialog_id || payload?.dialog_id
  const messages = event?.chat?.messages || event?.messages || event?.chat_log || payload?.chat?.messages || payload?.messages || []
  const eventAt = toIsoDate(event?.event_timestamp || payload?.event_timestamp) || new Date().toISOString()
  const firstVisitorAt = Array.isArray(messages) ? firstMessageAt(messages, 'visitor') : null
  const firstAgentAt = Array.isArray(messages) ? firstMessageAt(messages, 'agent') : null
  const startedAt = toIsoDate(event?.chat?.started_at || event?.started_at || payload?.started_at) || firstVisitorAt || eventAt
  const acceptedAt = toIsoDate(event?.accepted_at || payload?.accepted_at) || (eventName === 'chat_accepted' ? eventAt : null)
  const firstResponseAt = toIsoDate(event?.first_response_at || payload?.first_response_at) || firstAgentAt || null
  const finishedAt = eventName === 'chat_finished' ? eventAt : toIsoDate(event?.finished_at || payload?.finished_at)
  const status = normalizeStatus(eventName, event)
  const responseSeconds = event?.response_seconds
    ?? payload?.response_seconds
    ?? secondsBetween(firstVisitorAt || acceptedAt || startedAt, firstResponseAt)
  const waitSeconds = secondsBetween(startedAt, firstResponseAt || acceptedAt || finishedAt || eventAt)
  const acceptSeconds = secondsBetween(startedAt, acceptedAt)
  const abandoned = Boolean(
    (status === 'missed' || (finishedAt && !firstResponseAt))
    && waitSeconds != null
    && waitSeconds >= 30
  )
  const lateResponse = Boolean(
    (typeof responseSeconds === 'number' && responseSeconds > JIVO_RESPONSE_SLA_SECONDS)
    || (!firstResponseAt && waitSeconds != null && waitSeconds > JIVO_RESPONSE_SLA_SECONDS)
  )

  return {
    eventName,
    conversation: {
      jivo_chat_id: chatId ? String(chatId) : null,
      jivo_client_id: event?.client_id || payload?.client_id || visitor?.id || null,
      jivo_widget_id: event?.widget_id || payload?.widget_id || null,
      channel: normalizeChannel(event?.channel || payload?.channel || event?.source || payload?.source || event?.widget_id || payload?.widget_id),
      source: event?.source || payload?.source || 'Jivo',
      manager_id: agent?.id ? `jivo-${agent.id}` : 'manager-main',
      manager_name: agent?.name || agent?.email || 'Jivo operator',
      client_name: visitor?.name || event?.name || 'Клиент из Jivo',
      client_phone: visitor?.phone || event?.phone || '',
      status,
      last_event_at: eventAt,
      started_at: startedAt,
      accepted_at: acceptedAt,
      first_response_at: firstResponseAt,
      finished_at: finishedAt,
      response_seconds: responseSeconds,
      wait_seconds: waitSeconds,
      accept_seconds: acceptSeconds,
      abandoned,
      late_response: lateResponse,
      response_sla_seconds: JIVO_RESPONSE_SLA_SECONDS,
      messages_count: Array.isArray(messages) ? messages.length : Number(event?.messages_count || 0),
      calls_count: Number(event?.calls_count || 0),
      consultation_count: Number(event?.consultation_count || 0),
      appointment_created: Boolean(event?.appointment_created),
      sale_closed: Boolean(event?.sale_closed),
      sale_amount: Number(event?.sale_amount || 0),
      raw_payload: payload,
    },
  }
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null)

  if (!payload) {
    return NextResponse.json({ result: 'error', message: 'Invalid JSON' }, { status: 400 })
  }

  const normalized = normalizeJivoPayload(payload)

  const saved = process.env.DATABASE_URL
    ? await upsertJivoEvent(normalized.eventName, normalized.conversation, payload)
    : null

  return NextResponse.json({
    result: 'ok',
    custom_data: [
      { title: 'CRM', content: 'LIFE DENTAL CRM webhook received' },
      { title: 'KPI', content: 'Диалог будет учтен в KPI менеджера после подключения серверной базы' },
    ],
    normalized,
    saved,
  })
}

export async function GET() {
  return NextResponse.json({
    result: 'ok',
    service: 'LIFE DENTAL Jivo webhook',
    expects: 'POST JSON from Jivo CRM Webhooks',
  })
}
