import { addDays, addMonths, setHours, setMinutes } from 'date-fns'
import { db } from './insforge'

type AftercareSource = {
  patientId: string
  patientName?: string
  sourceType: 'appointment' | 'treatment_plan' | 'patient'
  sourceId?: string
  checkupMonths?: number
}

type LeadStatusAutomationSource = {
  lead: any
  status: string
  reason?: string
}

const atWorkTime = (date: Date, hour = 10, minute = 0) => setMinutes(setHours(date, hour), minute)

async function taskExists(automationKey: string) {
  const { data } = await db.from('tasks').select('*').eq('automation_key', automationKey)
  return Boolean(data?.length)
}

async function createAutomatedTask(payload: any) {
  if (payload.automation_key && await taskExists(payload.automation_key)) return false
  await db.from('tasks').insert([{
    ...payload,
    status: payload.status || 'open',
    priority: payload.priority || 'normal',
    is_automated: true,
  }])
  return true
}

async function addContactHistory(payload: any) {
  await db.from('contact_history').insert([{
    type: payload.type || 'note',
    direction: payload.direction || 'outgoing',
    summary: payload.summary,
    patient_id: payload.patient_id || null,
    lead_id: payload.lead_id || null,
  }])
}

export async function ensurePatientAftercareTasks({
  patientId,
  patientName = 'пациент',
  sourceType,
  sourceId = patientId,
  checkupMonths = 6,
}: AftercareSource) {
  const baseKey = `${sourceType}:${sourceId}:aftercare`
  const now = new Date()
  const checkupDate = atWorkTime(addMonths(now, checkupMonths), 10, 0)

  const templates = [
    {
      automation_key: `${baseKey}:wellbeing-day-1`,
      title: `Проверить самочувствие: ${patientName}`,
      description: 'Позвонить пациенту после лечения: боль, отек, температура, выполняет ли рекомендации. Если есть жалобы - передать врачу.',
      due_at: atWorkTime(addDays(now, 1), 10, 0).toISOString(),
      priority: 'high',
    },
    {
      automation_key: `${baseKey}:wellbeing-day-3`,
      title: `Повторно проверить самочувствие: ${patientName}`,
      description: 'Контроль через 3 дня: уточнить динамику, напомнить рекомендации, при необходимости предложить контрольный осмотр.',
      due_at: atWorkTime(addDays(now, 3), 10, 0).toISOString(),
      priority: 'normal',
    },
    {
      automation_key: `${baseKey}:review-day-3`,
      title: `Попросить отзыв: ${patientName}`,
      description: 'Если пациент доволен лечением - попросить оставить отзыв Google/соцсети. Отправить ссылку и отметить результат в контактах.',
      due_at: atWorkTime(addDays(now, 3), 12, 0).toISOString(),
      priority: 'normal',
    },
    {
      automation_key: `${baseKey}:video-review-day-7`,
      title: `Попросить фото/видео отзыв: ${patientName}`,
      description: 'Подходит для довольных пациентов после заметного результата. Предложить короткий видео/фото отзыв или согласие на кейс.',
      due_at: atWorkTime(addDays(now, 7), 12, 0).toISOString(),
      priority: 'low',
    },
    {
      automation_key: `${baseKey}:checkup-booking`,
      title: `Записать на контрольный осмотр: ${patientName}`,
      description: `Поставить пациента в расписание на проверку. Рекомендуемый срок контроля: через ${checkupMonths} мес.`,
      due_at: atWorkTime(addMonths(now, Math.max(1, checkupMonths - 1)), 10, 0).toISOString(),
      priority: 'normal',
    },
    {
      automation_key: `${baseKey}:repeat-visit-${checkupMonths}-months`,
      title: `Контроль повторного визита через ${checkupMonths} мес.: ${patientName}`,
      description: 'Связаться с пациентом, напомнить о профилактике/контрольном осмотре и предложить удобное время записи.',
      due_at: checkupDate.toISOString(),
      priority: 'high',
    },
  ]

  let created = 0
  for (const task of templates) {
    const ok = await createAutomatedTask({
      ...task,
      patient_id: patientId,
      source_type: sourceType,
      source_id: sourceId,
    })
    if (ok) created += 1
  }

  await db.from('patients').update({
    planned_checkup_at: checkupDate.toISOString().slice(0, 10),
    next_follow_up_at: templates[0].due_at,
    status: 'needs_follow_up',
    aftercare_started_at: now.toISOString(),
    aftercare_checkup_months: checkupMonths,
  }).eq('id', patientId)

  return created
}

export async function ensureLeadStatusAutomation({ lead, status, reason = '' }: LeadStatusAutomationSource) {
  const now = new Date()
  const patientId = lead.converted_patient_id || lead.patient_id || null
  const leadId = lead.id
  const clientName = lead.name || 'клиент'
  const reasonText = reason.trim()
  const baseSummary = reasonText ? ` Причина/комментарий: ${reasonText}` : ''

  const statusLabels: Record<string, string> = {
    contacted: 'Связались по заявке',
    thinking: 'Клиент думает',
    scheduled: 'Клиент записан',
    no_answer: 'Клиент не отвечает',
    cancelled: 'Заявка отменена',
    rejected: 'Отказ по заявке',
    lost: 'Клиент потерян',
  }

  await addContactHistory({
    patient_id: patientId,
    lead_id: leadId,
    type: status === 'cancelled' || status === 'rejected' || status === 'lost' ? 'note' : 'call',
    summary: `${statusLabels[status] || `Статус заявки изменен: ${status}`}.${baseSummary}`,
  })

  if (patientId && ['no_answer', 'cancelled', 'rejected', 'lost'].includes(status)) {
    await db.from('patients').update({
      status: status === 'no_answer' ? 'no_answer' : 'lost',
      manager_notes: `${statusLabels[status] || status}.${baseSummary}`.trim(),
    }).eq('id', patientId)
  }

  if (status === 'cancelled' || status === 'rejected') {
    await createAutomatedTask({
      automation_key: `lead:${leadId}:cancelled:callback-day-1`,
      title: `Перезвонить после отмены: ${clientName}`,
      description: `Уточнить, почему клиент отменил/не пришел, снять возражение и предложить новое удобное время.${baseSummary}`,
      due_at: atWorkTime(addDays(now, 1), 10, 0).toISOString(),
      priority: 'high',
      patient_id: patientId,
      lead_id: leadId,
      source_type: 'lead_status',
      source_id: leadId,
    })
  }

  if (status === 'no_answer') {
    await db.from('leads').update({
      no_answer_since: lead.no_answer_since || now.toISOString(),
      lost_funnel_state: 'waiting_3_days',
      lost_sequence_started_at: null,
    }).eq('id', leadId)

    await createAutomatedTask({
      automation_key: `lead:${leadId}:no-answer-check-day-3`,
      title: `Контроль: клиент 3 дня не отвечает - ${clientName}`,
      description: `Если клиент не ответил за 3 дня, перевести в потерянную воронку и запустить касания 7/14/30. Сейчас: написать/позвонить, проверить WhatsApp/Jivo/Instagram и оставить результат в истории.${baseSummary}`,
      due_at: atWorkTime(addDays(now, 3), 10, 0).toISOString(),
      priority: 'high',
      patient_id: patientId,
      lead_id: leadId,
      source_type: 'no_answer_control',
      source_id: leadId,
    })
  }

  if (status === 'lost') {
    await ensureLostLeadRecovery({
      lead: { ...lead, status },
      reason,
      startDate: now,
    })
  }
}

export async function ensureLostLeadRecovery({
  lead,
  reason = '',
  startDate = new Date(),
}: {
  lead: any
  reason?: string
  startDate?: Date
}) {
  const patientId = lead.converted_patient_id || lead.patient_id || null
  const leadId = lead.id
  const clientName = lead.name || 'клиент'
  const reasonText = reason.trim()
  const baseSummary = reasonText ? ` Причина/комментарий: ${reasonText}` : ''

  if (lead.lost_sequence_started_at) return 0

  await db.from('leads').update({
    status: 'lost',
    lost_funnel_state: 'recovery_active',
    lost_sequence_started_at: startDate.toISOString(),
    next_contact_at: atWorkTime(addDays(startDate, 7), 10, 0).toISOString(),
  }).eq('id', leadId)

  if (patientId) {
    await db.from('patients').update({
      status: 'lost',
      next_follow_up_at: atWorkTime(addDays(startDate, 7), 10, 0).toISOString(),
      manager_notes: `Потерянная воронка запущена.${baseSummary}`.trim(),
    }).eq('id', patientId)
  }

  await addContactHistory({
    patient_id: patientId,
    lead_id: leadId,
    type: 'note',
    summary: `Запущена система потерянного клиента: касания 7/14/30.${baseSummary}`,
  })

  const templates = [
    {
      key: 'lost-touch-7',
      days: 7,
      priority: 'high',
      title: `Вернуть потерянного клиента: ${clientName}`,
      description: `Касание 7 дней. Позвонить/написать: "Хотели уточнить, актуален ли еще вопрос по лечению. Можем подобрать ближайшее окно и отправить пример похожего случая". Если нет ответа - отметить результат и оставить в цепочке.${baseSummary}`,
    },
    {
      key: 'lost-touch-14',
      days: 14,
      priority: 'normal',
      title: `Отправить кейс лечения: ${clientName}`,
      description: 'Касание 14 дней. Отправить полезный кейс/пример до-после, коротко напомнить о проблеме пациента, предложить консультацию или диагностику без давления.',
    },
    {
      key: 'lost-touch-30',
      days: 30,
      priority: 'normal',
      title: `Акция или новый кейс для клиента: ${clientName}`,
      description: 'Касание 30 дней. Отправить актуальную акцию, новый кейс, отзыв пациента или напоминание о диагностике. Если ответа нет - оставить в долгой базе и не держать в ежедневных уведомлениях.',
    },
  ]

  let created = 0
  for (const template of templates) {
    const ok = await createAutomatedTask({
      automation_key: `lead:${leadId}:${template.key}`,
      title: template.title,
      description: template.description,
      due_at: atWorkTime(addDays(startDate, template.days), 10, 0).toISOString(),
      priority: template.priority,
      patient_id: patientId,
      lead_id: leadId,
      source_type: 'lost_lead',
      source_id: leadId,
    })
    if (ok) created += 1
  }

  return created
}

export async function runLostLeadSweep(leads: any[]) {
  const now = new Date()
  let changed = 0

  for (const lead of leads) {
    if (lead.status !== 'no_answer') continue
    if (lead.lost_sequence_started_at) continue
    const since = lead.no_answer_since || lead.updated_at || lead.created_at
    if (!since) continue
    const threeDaysLater = addDays(new Date(since), 3)
    if (threeDaysLater > now) continue
    await ensureLostLeadRecovery({
      lead,
      reason: 'Клиент не отвечает 3 дня',
      startDate: now,
    })
    changed += 1
  }

  return changed
}
