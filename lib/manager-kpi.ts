import { endOfDay, format, isAfter, isBefore, isSameDay, parseISO, startOfDay, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'

export type KpiRange = 'today' | 'yesterday' | 'week' | 'month'

export const jivoChannelLabels: Record<string, string> = {
  website: 'Сайт',
  instagram: 'Instagram',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  phone: 'Звонки',
  offline: 'Оффлайн',
  other: 'Другое',
}

export const jivoChannelColors: Record<string, string> = {
  website: '#14b8a6',
  instagram: '#ec4899',
  facebook: '#2563eb',
  whatsapp: '#22c55e',
  telegram: '#38bdf8',
  phone: '#f59e0b',
  offline: '#64748b',
  other: '#94a3b8',
}

export function rangeBounds(range: KpiRange) {
  const now = new Date()
  if (range === 'yesterday') {
    const yesterday = subDays(now, 1)
    return { start: startOfDay(yesterday), end: endOfDay(yesterday), label: 'Вчера' }
  }
  if (range === 'week') return { start: startOfDay(subDays(now, 6)), end: endOfDay(now), label: '7 дней' }
  if (range === 'month') return { start: startOfDay(subDays(now, 29)), end: endOfDay(now), label: '30 дней' }
  return { start: startOfDay(now), end: endOfDay(now), label: 'Сегодня' }
}

export function inRange(dateLike: string | null | undefined, start: Date, end: Date) {
  if (!dateLike) return false
  const date = parseISO(dateLike)
  return (isAfter(date, start) || date.getTime() === start.getTime()) && (isBefore(date, end) || date.getTime() === end.getTime())
}

export function formatSeconds(seconds: number | null | undefined) {
  if (seconds == null || Number.isNaN(seconds)) return '-'
  if (seconds < 60) return `${Math.round(seconds)} сек`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return rest ? `${minutes} мин ${rest} сек` : `${minutes} мин`
}

function numericSeconds(value: any) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function conversationWaitSeconds(item: any) {
  const stored = numericSeconds(item.wait_seconds)
  if (
    stored != null
    && (
      item.first_response_at
      || item.accepted_at
      || ((item.finished_at || item.status === 'missed') && stored >= 30)
    )
  ) return stored

  const start = item.started_at || item.created_at
  const end = item.first_response_at || item.accepted_at || item.finished_at || new Date().toISOString()
  if (!start || !end) return null
  const diff = Math.round((parseISO(end).getTime() - parseISO(start).getTime()) / 1000)
  return Number.isFinite(diff) && diff >= 0 ? diff : null
}

function isAbandonedConversation(item: any) {
  const wait = conversationWaitSeconds(item)
  return Boolean((item.abandoned || item.status === 'missed' || (item.finished_at && !item.first_response_at)) && wait != null && wait >= 30)
}

function isLateConversation(item: any) {
  const sla = Number(item.response_sla_seconds || 120)
  const response = numericSeconds(item.response_seconds)
  const wait = conversationWaitSeconds(item)
  return Boolean(item.late_response || (response != null && response > sla) || (!item.first_response_at && wait != null && wait > sla))
}

export function managerName(managerId: string | null | undefined, managers: any[]) {
  const manager = managers.find((item) => item.id === managerId)
  return manager?.full_name || manager?.name || 'Менеджер'
}

function conversationKey(item: any) {
  return item.jivo_chat_id || item.jivo_client_id || `${item.client_phone || item.client_name || 'client'}-${(item.started_at || item.created_at || '').slice(0, 10)}`
}

function conversationContactKey(item: any) {
  const contact = item.client_phone || item.client_name
  const day = (item.started_at || item.created_at || '').slice(0, 10)
  return contact && day ? `${contact}-${day}` : ''
}

function uniqueConversations(conversations: any[]) {
  const map = new Map<string, any>()
  conversations.forEach((item) => {
    const key = conversationKey(item)
    const contactKey = conversationContactKey(item)
    const existingEntry = Array.from(map.entries()).find(([existingKey, existingItem]) => {
      return existingKey === key || (contactKey && conversationContactKey(existingItem) === contactKey)
    })
    const existing = existingEntry?.[1]
    if (!existing) {
      map.set(key, item)
      return
    }

    const itemHasManager = item.manager_name && item.manager_name !== 'Jivo operator'
    const existingHasManager = existing.manager_name && existing.manager_name !== 'Jivo operator'
    map.set(key, {
      ...existing,
      ...item,
      manager_id: itemHasManager || !existingHasManager ? item.manager_id : existing.manager_id,
      manager_name: itemHasManager || !existingHasManager ? item.manager_name : existing.manager_name,
      accepted_at: item.accepted_at || existing.accepted_at,
      first_response_at: item.first_response_at || existing.first_response_at,
      response_seconds: item.response_seconds ?? existing.response_seconds,
      wait_seconds: item.wait_seconds ?? existing.wait_seconds,
      accept_seconds: item.accept_seconds ?? existing.accept_seconds,
      abandoned: Boolean(item.abandoned ?? existing.abandoned),
      late_response: Boolean(existing.late_response || item.late_response),
      response_sla_seconds: item.response_sla_seconds ?? existing.response_sla_seconds,
      messages_count: Math.max(Number(existing.messages_count || 0), Number(item.messages_count || 0)),
      calls_count: Math.max(Number(existing.calls_count || 0), Number(item.calls_count || 0)),
      consultation_count: Math.max(Number(existing.consultation_count || 0), Number(item.consultation_count || 0)),
      appointment_created: Boolean(existing.appointment_created || item.appointment_created),
      sale_closed: Boolean(existing.sale_closed || item.sale_closed),
      sale_amount: Math.max(Number(existing.sale_amount || 0), Number(item.sale_amount || 0)),
      status: existing.status === 'missed' && item.status !== 'missed' ? item.status : item.status || existing.status,
    })
    if (existingEntry && existingEntry[0] !== key) map.delete(existingEntry[0])
  })
  return Array.from(map.values())
}

function displayManagerName(managerId: string, managers: any[], conversations: any[]) {
  const manager = managers.find((item) => item.id === managerId)
  if (manager) return manager.full_name || manager.name || 'Менеджер'
  const conversation = conversations.find((item) => (item.manager_id || 'manager-main') === managerId && item.manager_name)
  return conversation?.manager_name || 'Менеджер'
}

export function dailyLabels(range: KpiRange) {
  const days = range === 'month' ? 14 : range === 'week' ? 7 : 1
  return Array.from({ length: days }).map((_, index) => {
    const date = subDays(new Date(), days - index - 1)
    return {
      date,
      label: format(date, 'd MMM', { locale: ru }),
    }
  })
}

export function buildManagerKpi({
  range,
  managers,
  conversations,
  leads,
  appointments,
  payments,
}: {
  range: KpiRange
  managers: any[]
  conversations: any[]
  leads: any[]
  appointments: any[]
  payments: any[]
}) {
  const bounds = rangeBounds(range)
  const rangedConversations = uniqueConversations(conversations.filter((item) => inRange(item.started_at || item.created_at, bounds.start, bounds.end)))
  const rangedLeads = leads.filter((item) => inRange(item.created_at, bounds.start, bounds.end))
  const rangedAppointments = appointments.filter((item) => inRange(item.start_at || item.created_at, bounds.start, bounds.end))
  const rangedPayments = payments.filter((item) => inRange(item.paid_at || item.created_at, bounds.start, bounds.end))

  const activeManagerIds = Array.from(new Set([
    ...managers.map((item) => item.id),
    ...rangedConversations.map((item) => item.manager_id).filter(Boolean),
    'manager-main',
  ]))

  const rows = activeManagerIds.map((managerId) => {
    const managerConversations = rangedConversations.filter((item) => (item.manager_id || 'manager-main') === managerId)
    const managerLeads = rangedLeads.filter((item) => (item.assigned_to || item.manager_id || 'manager-main') === managerId)
    const managerAppointments = rangedAppointments.filter((item) => (item.manager_id || item.created_by || 'manager-main') === managerId)
    const managerPayments = rangedPayments.filter((item) => (item.manager_id || 'manager-main') === managerId)
    const responseTimes = managerConversations
      .map((item) => item.first_response_at ? numericSeconds(item.response_seconds) : null)
      .filter((value): value is number => value != null)
    const waitTimes = managerConversations
      .map(conversationWaitSeconds)
      .filter((value): value is number => typeof value === 'number')
    const appointmentsCount = managerAppointments.length + managerConversations.filter((item) => item.appointment_created && !item.crm_appointment_id).length
    const salesAmount = managerPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
      + managerConversations.reduce((sum, item) => sum + Number(item.sale_amount || 0), 0)
    const closedSales = managerConversations.filter((item) => item.sale_closed).length
      + managerPayments.filter((payment) => Number(payment.amount || 0) > 0).length
    const clients = new Set(managerConversations.map((item) => item.client_phone || item.client_name || item.jivo_chat_id).filter(Boolean))
    const totalRequests = managerLeads.length + managerConversations.length

    return {
      managerId,
      managerName: displayManagerName(managerId, managers, rangedConversations),
      newLeads: managerLeads.length + managerConversations.filter((item) => item.status !== 'internal').length,
      conversations: managerConversations.length,
      clients: clients.size,
      avgResponseSeconds: responseTimes.length ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length) : null,
      avgWaitSeconds: waitTimes.length ? Math.round(waitTimes.reduce((sum, value) => sum + value, 0) / waitTimes.length) : null,
      calls: managerConversations.reduce((sum, item) => sum + Number(item.calls_count || 0), 0),
      consultations: managerConversations.reduce((sum, item) => sum + Number(item.consultation_count || 0), 0),
      appointments: appointmentsCount,
      closedSales,
      salesAmount,
      conversion: totalRequests ? Math.round((appointmentsCount / totalRequests) * 100) : 0,
      missed: managerConversations.filter(isAbandonedConversation).length,
      lateResponses: managerConversations.filter(isLateConversation).length,
    }
  })

  const totals = rows.reduce((acc, row) => ({
    newLeads: acc.newLeads + row.newLeads,
    conversations: acc.conversations + row.conversations,
    clients: acc.clients + row.clients,
    calls: acc.calls + row.calls,
    consultations: acc.consultations + row.consultations,
    appointments: acc.appointments + row.appointments,
    closedSales: acc.closedSales + row.closedSales,
    salesAmount: acc.salesAmount + row.salesAmount,
    missed: acc.missed + row.missed,
    lateResponses: acc.lateResponses + row.lateResponses,
  }), {
    newLeads: 0,
    conversations: 0,
    clients: 0,
    calls: 0,
    consultations: 0,
    appointments: 0,
    closedSales: 0,
    salesAmount: 0,
    missed: 0,
    lateResponses: 0,
  })

  const responseValues = rows.map((row) => row.avgResponseSeconds).filter((value): value is number => typeof value === 'number')
  const avgResponseSeconds = responseValues.length
    ? Math.round(responseValues.reduce((sum, value) => sum + value, 0) / responseValues.length)
    : null
  const waitValues = rows.map((row) => row.avgWaitSeconds).filter((value): value is number => typeof value === 'number')
  const avgWaitSeconds = waitValues.length
    ? Math.round(waitValues.reduce((sum, value) => sum + value, 0) / waitValues.length)
    : null
  const conversion = totals.newLeads ? Math.round((totals.appointments / totals.newLeads) * 100) : 0

  const byChannel = Object.entries(rangedConversations.reduce((acc: Record<string, number>, item) => {
    const channel = item.channel || 'other'
    acc[channel] = (acc[channel] || 0) + 1
    return acc
  }, {})).map(([channel, value]) => ({
    label: jivoChannelLabels[channel] || channel,
    value,
    color: jivoChannelColors[channel] || jivoChannelColors.other,
  }))

  const trend = dailyLabels(range).map((day) => ({
    label: day.label,
    value: uniqueConversations(conversations).filter((item) => {
      const date = item.started_at || item.created_at
      return date && isSameDay(parseISO(date), day.date)
    }).length,
  }))

  return {
    bounds,
    rows: rows.sort((a, b) => b.salesAmount - a.salesAmount || b.appointments - a.appointments),
    totals: { ...totals, avgResponseSeconds, avgWaitSeconds, conversion },
    byChannel,
    trend,
    rangedConversations,
  }
}

export function kpiScore(row: any, target: any) {
  if (!target) return 0
  const parts = [
    target.new_leads ? Math.min(100, (row.newLeads / target.new_leads) * 100) : 0,
    target.calls ? Math.min(100, (row.calls / target.calls) * 100) : 0,
    target.consultations ? Math.min(100, (row.consultations / target.consultations) * 100) : 0,
    target.appointments ? Math.min(100, (row.appointments / target.appointments) * 100) : 0,
    target.closed_sales ? Math.min(100, (row.closedSales / target.closed_sales) * 100) : 0,
    target.sales_amount ? Math.min(100, (row.salesAmount / target.sales_amount) * 100) : 0,
    target.conversion_percent ? Math.min(100, (row.conversion / target.conversion_percent) * 100) : 0,
    target.avg_response_seconds && row.avgResponseSeconds
      ? Math.min(100, (target.avg_response_seconds / row.avgResponseSeconds) * 100)
      : 0,
  ].filter((value) => Number.isFinite(value))

  return parts.length ? Math.round(parts.reduce((sum, value) => sum + value, 0) / parts.length) : 0
}
