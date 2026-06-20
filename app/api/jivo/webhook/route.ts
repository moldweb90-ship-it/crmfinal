import { NextRequest, NextResponse } from 'next/server'
import { upsertJivoEvent } from '@/lib/server-db'

function secondsBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return null
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  return Number.isFinite(diff) && diff >= 0 ? diff : null
}

function normalizeJivoPayload(payload: any) {
  const eventName = payload?.event_name || payload?.event?.event_name || payload?.event_type || 'unknown'
  const event = payload?.event || payload
  const visitor = event?.visitor || payload?.visitor || {}
  const agent = event?.agent || event?.assigned_agent || payload?.agent || payload?.assigned_agent || {}
  const chatId = event?.chat_id || payload?.chat_id || event?.id || payload?.id
  const startedAt = event?.chat?.started_at || event?.started_at || payload?.started_at || new Date().toISOString()
  const acceptedAt = event?.accepted_at || payload?.accepted_at || null
  const firstResponseAt = event?.first_response_at || payload?.first_response_at || acceptedAt
  const finishedAt = eventName === 'chat_finished' ? new Date().toISOString() : event?.finished_at || payload?.finished_at || null
  const messages = event?.messages || event?.chat_log || payload?.messages || []

  return {
    eventName,
    conversation: {
      jivo_chat_id: chatId ? String(chatId) : null,
      channel: event?.channel || payload?.channel || event?.widget_id || 'website',
      source: event?.source || payload?.source || 'Jivo',
      manager_id: agent?.id ? `jivo-${agent.id}` : 'manager-main',
      manager_name: agent?.name || agent?.email || 'Jivo operator',
      client_name: visitor?.name || event?.name || 'Клиент из Jivo',
      client_phone: visitor?.phone || event?.phone || '',
      status: eventName === 'offline_message' ? 'missed' : eventName === 'chat_finished' ? 'finished' : 'active',
      started_at: startedAt,
      accepted_at: acceptedAt,
      first_response_at: firstResponseAt,
      finished_at: finishedAt,
      response_seconds: event?.response_seconds ?? payload?.response_seconds ?? secondsBetween(acceptedAt || startedAt, firstResponseAt),
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
