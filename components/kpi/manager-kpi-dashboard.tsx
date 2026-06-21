'use client'

import { useEffect, useMemo, useState } from 'react'
import { addDays, addMinutes, format, setHours, setMinutes } from 'date-fns'
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Clock3,
  Headphones,
  MessageCircle,
  PlugZap,
  CalendarPlus,
  Target,
  TrendingUp,
  Trash2,
  UserCheck,
  UsersRound,
  Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AreaTrendChart, DonutChart, RadialScore, SoftBarChart } from '@/components/dashboard/charts'
import {
  buildManagerKpi,
  formatSeconds,
  jivoChannelColors,
  jivoChannelLabels,
  kpiScore,
  type KpiRange,
} from '@/lib/manager-kpi'
import {
  useAppointments,
  useClinics,
  useContactHistory,
  useDoctors,
  useJivoConversations,
  useLeads,
  useManagerKpiTargets,
  useManagers,
  usePayments,
  usePatients,
  useTasks,
} from '@/lib/hooks'
import { money } from '@/lib/crm'
import { db } from '@/lib/insforge'
import { useAuth } from '@/lib/auth'

const rangeLabels: Record<KpiRange, string> = {
  today: 'Сегодня',
  yesterday: 'Вчера',
  week: '7 дней',
  month: '30 дней',
}

export function ManagerKpiDashboard() {
  const [range, setRange] = useState<KpiRange>('today')
  const [clockTick, setClockTick] = useState(0)
  const { user } = useAuth()
  const { managers } = useManagers()
  const { conversations } = useJivoConversations()
  const { mutate: mutateConversations } = useJivoConversations()
  const { targets } = useManagerKpiTargets()
  const { leads, mutate: mutateLeads } = useLeads()
  const { appointments, mutate: mutateAppointments } = useAppointments()
  const { payments } = usePayments()
  const { patients, mutate: mutatePatients } = usePatients()
  const { tasks, mutate: mutateTasks } = useTasks()
  const { contacts, mutate: mutateContacts } = useContactHistory()
  const { doctors } = useDoctors()
  const { clinics } = useClinics()
  const [actionDialog, setActionDialog] = useState<{ open: boolean; conversation: any | null }>({ open: false, conversation: null })
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; conversation: any | null }>({ open: false, conversation: null })
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null)
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick((value) => value + 1), 15000)
    return () => window.clearInterval(timer)
  }, [])

  const kpi = useMemo(() => buildManagerKpi({
    range,
    managers,
    conversations,
    leads,
    appointments,
    payments,
  }), [range, managers, conversations, leads, appointments, payments, clockTick])

  const primaryRow = kpi.rows[0]
  const primaryTarget = targets.find((target: any) => target.manager_id === primaryRow?.managerId) || targets[0]
  const score = primaryRow ? kpiScore(primaryRow, primaryTarget) : 0

  const channelSegments = kpi.byChannel.length
    ? kpi.byChannel
    : [{ label: 'Нет данных', value: 1, color: '#e2e8f0' }]

  const bars = [
    { label: 'Заявки', value: kpi.totals.newLeads },
    { label: 'Чаты', value: kpi.totals.conversations },
    { label: 'Звонки', value: kpi.totals.calls },
    { label: 'Записи', value: kpi.totals.appointments },
    { label: 'Продажи', value: kpi.totals.closedSales },
  ]
  const handled = Math.max(0, kpi.totals.conversations - kpi.totals.missed)
  const handledPercent = kpi.totals.conversations ? Math.round((handled / kpi.totals.conversations) * 100) : 0
  const missedPercent = kpi.totals.conversations ? Math.round((kpi.totals.missed / kpi.totals.conversations) * 100) : 0
  const latePercent = kpi.totals.conversations ? Math.round((kpi.totals.lateResponses / kpi.totals.conversations) * 100) : 0

  const deleteJivoConversation = async (conversation: any) => {
    if (!isAdmin || !conversation?.id) return
    setDeletingConversationId(conversation.id)
    try {
      const linkedLeads = leads.filter((lead: any) => (
        lead.jivo_conversation_id === conversation.id
        && !lead.converted_patient_id
        && !lead.patient_id
      ))
      const linkedTasks = tasks.filter((task: any) => (
        task.jivo_conversation_id === conversation.id
        && task.source_type === 'jivo'
      ))
      const linkedContacts = contacts.filter((contact: any) => (
        linkedLeads.some((lead: any) => lead.id === contact.lead_id)
      ))

      for (const task of linkedTasks) {
        await db.from('tasks').delete().eq('id', task.id)
      }
      for (const contact of linkedContacts) {
        await db.from('contact_history').delete().eq('id', contact.id)
      }
      for (const lead of linkedLeads) {
        await db.from('leads').delete().eq('id', lead.id)
      }
      const { error } = await db.from('jivo_conversations').delete().eq('id', conversation.id)
      if (error) throw new Error(String(error))
      await Promise.all([mutateConversations(), mutateLeads(), mutateTasks(), mutateContacts()])
      setDeleteDialog({ open: false, conversation: null })
    } catch (error) {
      console.error('Jivo conversation delete failed:', error)
      alert('Не получилось удалить Jivo-диалог')
    } finally {
      setDeletingConversationId(null)
    }
  }

  return (
    <div className="space-y-6 animate-soft-in">
      <div className="overflow-hidden rounded-[2rem] border border-teal-100 bg-gradient-to-br from-white via-cyan-50 to-teal-50 p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-4 rounded-full border-teal-200 bg-white px-3 py-1 text-teal-700">
              <Activity className="mr-1.5 h-3.5 w-3.5" />
              Контроль менеджеров и Jivo
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">KPI менеджера</h1>
            <p className="mt-2 text-slate-600">
              Автоматическая статистика по обращениям, скорости ответа, звонкам, консультациям, записям, продажам и конверсии.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={range} onValueChange={(value) => setRange(value as KpiRange)}>
              <SelectTrigger className="h-11 w-[150px] rounded-2xl bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(rangeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild className="h-11 rounded-2xl bg-gradient-to-r from-teal-500 to-sky-500 text-white">
              <a href="/settings#jivo">
                <PlugZap className="mr-2 h-4 w-4" />
                Подключить Jivo
              </a>
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={UsersRound} label="Новые заявки" value={kpi.totals.newLeads} hint="CRM + Jivo" />
          <KpiCard icon={Clock3} label="Скорость ответа" value={formatSeconds(kpi.totals.avgResponseSeconds)} hint="среднее время" tone="teal" />
          <KpiCard icon={UserCheck} label="Записи" value={kpi.totals.appointments} hint={`${kpi.totals.conversion}% конверсия`} tone="sky" />
          <KpiCard icon={Wallet} label="Сумма продаж" value={money(kpi.totals.salesAmount)} hint={`${kpi.totals.closedSales} закрыто`} tone="emerald" />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <OwnerControlCard
          icon={BadgeCheck}
          label="Обработано обращений"
          value={`${handled}/${kpi.totals.conversations}`}
          hint={`${handledPercent}% диалогов не пропущены`}
          tone="emerald"
        />
        <OwnerControlCard
          icon={MessageCircle}
          label="Ушел без ответа"
          value={kpi.totals.missed}
          hint={kpi.totals.missed ? `${missedPercent}% без ответа` : 'уходов без ответа нет'}
          tone={kpi.totals.missed ? 'rose' : 'teal'}
        />
        <OwnerControlCard
          icon={Clock3}
          label="Клиент ждал"
          value={formatSeconds(kpi.totals.avgWaitSeconds)}
          hint="до ответа, принятия или ухода"
          tone={kpi.totals.avgWaitSeconds && kpi.totals.avgWaitSeconds > 120 ? 'rose' : 'sky'}
        />
        <OwnerControlCard
          icon={TrendingUp}
          label="Ответ поздно"
          value={kpi.totals.lateResponses}
          hint={kpi.totals.lateResponses ? `${latePercent}% сверх 2 мин` : 'в норме'}
          tone={kpi.totals.lateResponses ? 'rose' : 'teal'}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="crm-panel border-0">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-teal-600" />
                Динамика обращений
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500">Сколько диалогов пришло из подключенных каналов.</p>
            </div>
            <Badge variant="outline" className="w-fit bg-white">{rangeLabels[range]}</Badge>
          </CardHeader>
          <CardContent>
            <AreaTrendChart data={kpi.trend} />
          </CardContent>
        </Card>

        <Card className="crm-panel border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-teal-600" />
              Выполнение KPI
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <RadialScore value={score} label="план" />
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                Оценка собирается из заявок, звонков, консультаций, записей, продаж, суммы и скорости ответа.
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <MiniStat label="Звонки" value={kpi.totals.calls} />
                <MiniStat label="Консультации" value={kpi.totals.consultations} />
                <MiniStat label="Клиенты" value={kpi.totals.clients} />
                <MiniStat label="Сорвано" value={kpi.totals.missed} danger />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="crm-panel border-0">
          <CardHeader>
            <CardTitle>Каналы Jivo</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart segments={channelSegments} centerLabel="диалогов" centerValue={kpi.totals.conversations} />
          </CardContent>
        </Card>

        <Card className="crm-panel border-0">
          <CardHeader>
            <CardTitle>Воронка обработки</CardTitle>
          </CardHeader>
          <CardContent>
            <SoftBarChart data={bars} />
          </CardContent>
        </Card>
      </div>

      <Card className="crm-panel border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5 text-teal-600" />
            Менеджеры
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b bg-slate-50/70 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Менеджер</th>
                  <th className="px-4 py-3">KPI</th>
                  <th className="px-4 py-3">Заявки</th>
                  <th className="px-4 py-3">Ответ</th>
                  <th className="px-4 py-3">Клиент ждал</th>
                  <th className="px-4 py-3">Звонки</th>
                  <th className="px-4 py-3">Консультации</th>
                  <th className="px-4 py-3">Записи</th>
                  <th className="px-4 py-3">Продажи</th>
                  <th className="px-4 py-3">Сумма</th>
                  <th className="px-4 py-3">Конверсия</th>
                </tr>
              </thead>
              <tbody>
                {kpi.rows.map((row) => {
                  const target = targets.find((item: any) => item.manager_id === row.managerId) || targets[0]
                  const rowScore = kpiScore(row, target)

                  return (
                    <tr key={row.managerId} className="border-b last:border-0">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-sky-500 font-semibold text-white">
                            {row.managerName.slice(0, 1)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-950">{row.managerName}</div>
                            <div className="text-xs text-slate-500">{row.conversations} диалогов, {row.clients} клиентов</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="outline" className={rowScore >= 80 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : rowScore >= 50 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-rose-200 bg-rose-50 text-rose-700'}>
                          {rowScore}%
                        </Badge>
                      </td>
                      <td className="px-4 py-4 font-medium">{row.newLeads}</td>
                      <td className="px-4 py-4">{formatSeconds(row.avgResponseSeconds)}</td>
                      <td className="px-4 py-4">{formatSeconds(row.avgWaitSeconds)}</td>
                      <td className="px-4 py-4">{row.calls}</td>
                      <td className="px-4 py-4">{row.consultations}</td>
                      <td className="px-4 py-4">{row.appointments}</td>
                      <td className="px-4 py-4">{row.closedSales}</td>
                      <td className="px-4 py-4 font-semibold">{money(row.salesAmount)}</td>
                      <td className="px-4 py-4">{row.conversion}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="crm-panel border-0">
        <CardHeader>
          <CardTitle>Последние диалоги Jivo</CardTitle>
          <p className="text-sm text-slate-500">
            Здесь виден клиент, канал, ответственный менеджер и качество обработки. Один реальный чат считается один раз.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {kpi.rangedConversations.slice(0, 6).map((item: any) => {
            const quality = jivoQuality(item)
            const waitLabel = quality.staleWithoutAnswer ? `${formatSeconds(quality.wait)}+` : formatSeconds(quality.wait)

            return (
              <div key={item.id} className="rounded-3xl border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{item.client_name || 'Клиент без имени'}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <span>{item.client_phone || 'нет телефона'}</span>
                      <span>•</span>
                      <span>{item.manager_name || 'Менеджер'}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {quality.abandoned ? (
                      <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">Ушел без ответа</Badge>
                    ) : quality.late ? (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Ответ поздно</Badge>
                    ) : item.first_response_at ? (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Ответ вовремя</Badge>
                    ) : (
                      <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">Ждет ответа</Badge>
                    )}
                    <Badge variant="outline" style={{ borderColor: jivoChannelColors[item.channel] || '#cbd5e1', color: jivoChannelColors[item.channel] || '#475569' }}>
                      {jivoChannelLabels[item.channel] || item.channel || 'Канал'}
                    </Badge>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <MiniStat label="Ждал" value={waitLabel} danger={quality.abandoned || quality.late} />
                  <MiniStat label="Ответ" value={formatSeconds(quality.response)} danger={quality.late} />
                  <MiniStat label="Сообщения" value={item.messages_count || 0} />
                  <MiniStat label="Продажа" value={item.sale_closed ? 'Да' : 'Нет'} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="rounded-xl bg-teal-600 hover:bg-teal-700"
                    onClick={() => setActionDialog({ open: true, conversation: item })}
                  >
                    <CalendarPlus className="mr-1.5 h-4 w-4" />
                    Разобрать
                  </Button>
                  {item.crm_appointment_id && (
                    <Badge variant="outline" className="rounded-xl border-emerald-200 bg-emerald-50 text-emerald-700">
                      Запись создана
                    </Badge>
                  )}
                  {item.outcome && !item.crm_appointment_id && (
                    <Badge variant="outline" className="rounded-xl bg-slate-50 text-slate-600">
                      {outcomeLabels[item.outcome] || item.outcome}
                    </Badge>
                  )}
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                      onClick={() => setDeleteDialog({ open: true, conversation: item })}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      Удалить
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
          {kpi.rangedConversations.length === 0 && (
            <div className="rounded-3xl border border-dashed p-8 text-center text-sm text-slate-500 lg:col-span-2">
              Диалогов за выбранный период пока нет. После подключения Jivo они будут попадать сюда автоматически.
            </div>
          )}
        </CardContent>
      </Card>

      <JivoActionDialog
        open={actionDialog.open}
        conversation={actionDialog.conversation}
        onOpenChange={(open) => setActionDialog((current) => ({ ...current, open }))}
        doctors={doctors}
        clinics={clinics}
        patients={patients}
        leads={leads}
        tasks={tasks}
        contacts={contacts}
        onDone={async () => {
          await Promise.all([
            mutateConversations(),
            mutatePatients(),
            mutateAppointments(),
            mutateTasks(),
            mutateContacts(),
            mutateLeads(),
          ])
          setActionDialog({ open: false, conversation: null })
        }}
      />
      <DeleteJivoConversationDialog
        open={deleteDialog.open}
        conversation={deleteDialog.conversation}
        deleting={deletingConversationId === deleteDialog.conversation?.id}
        onOpenChange={(open) => setDeleteDialog((current) => ({ ...current, open }))}
        onConfirm={() => deleteJivoConversation(deleteDialog.conversation)}
      />
    </div>
  )
}

function DeleteJivoConversationDialog({
  open,
  conversation,
  deleting,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  conversation: any | null
  deleting: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Удалить Jivo-диалог?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-3xl border bg-slate-50 p-4">
            <div className="font-semibold text-slate-950">{conversation?.client_name || 'Клиент без имени'}</div>
            <div className="mt-1 text-sm text-slate-500">
              {conversation?.client_phone || 'телефон не указан'} · {conversation?.manager_name || 'менеджер не определен'}
            </div>
          </div>
          <p className="text-sm leading-6 text-slate-600">
            Диалог исчезнет из KPI, графиков и списка последних Jivo-обращений. Если от него остались тестовые заявки или задачи без пациента и записи, они тоже будут очищены.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={deleting}>
            Отмена
          </Button>
          <Button type="button" className="rounded-xl bg-rose-600 hover:bg-rose-700" onClick={onConfirm} disabled={deleting || !conversation?.id}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            {deleting ? 'Удаляем...' : 'Удалить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const outcomeLabels: Record<string, string> = {
  appointment: 'Доведен до записи',
  thinking: 'Думает',
  callback: 'Перезвонить',
  no_answer: 'Не отвечает',
  rejected: 'Отказ',
}

const jivoSlaSeconds = 120
const jivoWaitingCutoffSeconds = 30 * 60

function jivoWaitSeconds(item: any) {
  const stored = Number(item?.wait_seconds)
  if (
    Number.isFinite(stored)
    && stored >= 0
    && (
      item?.first_response_at
      || item?.accepted_at
      || ((item?.finished_at || item?.status === 'missed') && stored >= 30)
    )
  ) return stored
  const start = item?.started_at || item?.created_at
  const end = item?.first_response_at || item?.accepted_at || item?.finished_at || new Date().toISOString()
  if (!start || !end) return null
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  if (!Number.isFinite(diff) || diff < 0) return null
  return item?.first_response_at || item?.accepted_at || item?.finished_at
    ? diff
    : Math.min(diff, jivoWaitingCutoffSeconds)
}

function jivoQuality(item: any) {
  const wait = jivoWaitSeconds(item)
  const response = Number(item?.response_seconds)
  const hasResponse = Boolean(item?.first_response_at && Number.isFinite(response) && response >= 0)
  const staleWithoutAnswer = !item?.first_response_at && !item?.accepted_at && !item?.finished_at && wait === jivoWaitingCutoffSeconds
  const abandoned = Boolean(((item?.abandoned || item?.status === 'missed' || (item?.finished_at && !item?.first_response_at)) && wait != null && wait >= 30) || staleWithoutAnswer)
  const late = Boolean(item?.late_response || (hasResponse && response > jivoSlaSeconds) || (!item?.first_response_at && wait != null && wait > jivoSlaSeconds))

  return { wait, response: hasResponse ? response : null, abandoned, late, staleWithoutAnswer }
}

function JivoActionDialog({
  open,
  onOpenChange,
  conversation,
  doctors,
  clinics,
  patients,
  leads,
  tasks,
  contacts,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversation: any | null
  doctors: any[]
  clinics: any[]
  patients: any[]
  leads: any[]
  tasks: any[]
  contacts: any[]
  onDone: () => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState('appointment')
  const [form, setForm] = useState({
    patient_id: '',
    patient_name: '',
    phone: '',
    doctor_id: '',
    clinic_id: '',
    service_name: 'Консультация',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    duration: '60',
    task_due: format(addDays(new Date(), 1), "yyyy-MM-dd'T'10:00"),
    comment: '',
  })

  useEffect(() => {
    if (!conversation) return
    const existingPatient = patients.find((patient: any) => {
      const phone = String(patient.phone || '').replace(/\D/g, '')
      const jivoPhone = String(conversation.client_phone || '').replace(/\D/g, '')
      return jivoPhone && phone.endsWith(jivoPhone.slice(-8))
    })
    setMode(conversation.outcome || 'appointment')
    setForm({
      patient_id: existingPatient?.id || conversation.crm_patient_id || '',
      patient_name: existingPatient?.full_name || conversation.client_name || '',
      phone: existingPatient?.phone || conversation.client_phone || '',
      doctor_id: doctors[0]?.id || '',
      clinic_id: clinics[0]?.id || '',
      service_name: 'Консультация',
      date: format(new Date(), 'yyyy-MM-dd'),
      time: '09:00',
      duration: '60',
      task_due: format(addDays(new Date(), 1), "yyyy-MM-dd'T'10:00"),
      comment: '',
    })
  }, [conversation, patients, doctors, clinics])

  const ensurePatient = async () => {
    if (form.patient_id) return form.patient_id
    const patientResult = await db.from('patients').insert([{
      full_name: form.patient_name || conversation?.client_name || 'Клиент из Jivo',
      phone: form.phone || conversation?.client_phone || null,
      source: 'jivo',
      status: mode === 'appointment' ? 'active' : mode === 'thinking' ? 'thinking' : 'needs_follow_up',
      preferred_contact_method: 'phone',
      manager_notes: form.comment || `Клиент из Jivo. Диалог ${conversation?.jivo_chat_id || conversation?.id || ''}`,
      total_spent: 0,
      debt: 0,
    }]).select()
    return patientResult.data?.[0]?.id || null
  }

  const ensureLead = async (status: string, patientId: string | null = null) => {
    const phone = String(form.phone || conversation?.client_phone || '').replace(/\D/g, '')
    const existingLead = leads.find((lead: any) => {
      const leadPhone = String(lead.phone || '').replace(/\D/g, '')
      return (
        (conversation?.crm_lead_id && lead.id === conversation.crm_lead_id)
        || (conversation?.jivo_chat_id && lead.jivo_chat_id === conversation.jivo_chat_id)
        || (phone && leadPhone && leadPhone.endsWith(phone.slice(-8)))
      )
    })
    const payload = {
      name: form.patient_name || conversation?.client_name || 'Клиент из Jivo',
      phone: form.phone || conversation?.client_phone || null,
      source: conversation?.channel || 'jivo',
      interested_service: form.service_name || 'Консультация',
      message: form.comment || `Диалог Jivo: ${conversation?.jivo_chat_id || conversation?.id || ''}`,
      next_contact_at: mode !== 'appointment' && mode !== 'rejected' && form.task_due ? new Date(form.task_due).toISOString() : null,
      status,
      converted_patient_id: patientId,
      patient_id: patientId,
      jivo_chat_id: conversation?.jivo_chat_id || null,
      jivo_conversation_id: conversation?.id || null,
    }

    if (existingLead) {
      await db.from('leads').update(payload).eq('id', existingLead.id)
      return existingLead.id
    }

    const leadResult = await db.from('leads').insert([payload]).select()
    return leadResult.data?.[0]?.id || null
  }

  const saveContact = async (patientId: string | null, summary: string, leadId: string | null = null) => {
    if (!patientId && !leadId) return
    const alreadyExists = contacts.some((contact: any) => (
      (patientId ? contact.patient_id === patientId : contact.lead_id === leadId)
      && contact.jivo_chat_id === (conversation?.jivo_chat_id || null)
      && contact.summary === summary
    ))
    if (alreadyExists) return

    await db.from('contact_history').insert([{
      patient_id: patientId,
      lead_id: leadId,
      type: 'jivo',
      summary,
      comment: form.comment || null,
      created_at: new Date().toISOString(),
      manager_id: conversation?.manager_id || 'manager-main',
      jivo_chat_id: conversation?.jivo_chat_id || null,
    }])
  }

  const handleSave = async () => {
    if (!conversation) return
    setSaving(true)
    try {
      let patientId = form.patient_id || conversation.crm_patient_id || null
      let leadId = conversation.crm_lead_id || null
      let appointmentId = conversation.crm_appointment_id || null
      let taskId = null

      if (mode === 'appointment') {
        patientId = await ensurePatient()
        leadId = await ensureLead('scheduled', patientId)
        const [hours, minutes] = form.time.split(':').map(Number)
        const baseDate = new Date(`${form.date}T00:00:00`)
        const start = setMinutes(setHours(baseDate, hours), minutes)
        const end = addMinutes(start, Number(form.duration || 60))
        const appointment = await db.from('appointments').insert([{
          clinic_id: form.clinic_id || clinics[0]?.id || null,
          patient_id: patientId,
          patient_name: form.patient_name || conversation.client_name || 'Клиент из Jivo',
          source: 'jivo',
          doctor_id: form.doctor_id || doctors[0]?.id || null,
          service_name: form.service_name || 'Консультация',
          complaint: form.comment || null,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          status: 'planned',
          manager_id: conversation.manager_id || 'manager-main',
          jivo_chat_id: conversation.jivo_chat_id || null,
          jivo_conversation_id: conversation.id,
        }]).select()
        appointmentId = appointment.data?.[0]?.id || null
        await saveContact(patientId, `Jivo: клиент доведен до записи на ${format(start, 'dd.MM.yyyy HH:mm')}`, leadId)
      } else if (mode === 'rejected') {
        leadId = await ensureLead('rejected', null)
        await saveContact(null, `Jivo: отказ клиента${form.comment ? ` - ${form.comment}` : ''}`, leadId)
      } else {
        const leadStatus = mode === 'thinking' ? 'thinking' : mode === 'no_answer' ? 'no_answer' : 'contacted'
        leadId = await ensureLead(leadStatus, patientId)
        const titles: Record<string, string> = {
          thinking: `Дожать после Jivo: ${form.patient_name || conversation.client_name}`,
          callback: `Перезвонить после Jivo: ${form.patient_name || conversation.client_name}`,
          no_answer: `Повторно связаться после Jivo: ${form.patient_name || conversation.client_name}`,
        }
        const existingTask = tasks.find((task: any) => (
          task.id === conversation.crm_task_id
          || (task.jivo_conversation_id === conversation.id && task.source_type === 'jivo' && task.status !== 'done' && task.status !== 'cancelled')
        ))
        const taskPayload = {
          title: titles[mode] || `Связаться после Jivo: ${form.patient_name || conversation.client_name}`,
          description: form.comment || `Диалог Jivo: ${conversation.jivo_chat_id || conversation.id}`,
          due_at: form.task_due ? new Date(form.task_due).toISOString() : addDays(new Date(), 1).toISOString(),
          priority: mode === 'no_answer' ? 'high' : 'normal',
          status: 'open',
          patient_id: patientId || null,
          lead_id: leadId || null,
          source_type: 'jivo',
          jivo_chat_id: conversation.jivo_chat_id || null,
          jivo_conversation_id: conversation.id,
          client_name: form.patient_name || conversation.client_name || null,
          client_phone: form.phone || conversation.client_phone || null,
          jivo_channel: conversation.channel || null,
        }

        if (existingTask) {
          await db.from('tasks').update(taskPayload).eq('id', existingTask.id)
          taskId = existingTask.id
        } else {
          const task = await db.from('tasks').insert([taskPayload]).select()
          taskId = task.data?.[0]?.id || null
        }
        await saveContact(patientId, `Jivo: результат обработки - ${outcomeLabels[mode] || mode}`, leadId)
      }

      await db.from('jivo_conversations').update({
        outcome: mode,
        crm_patient_id: patientId,
        crm_lead_id: leadId,
        crm_appointment_id: appointmentId,
        crm_task_id: taskId,
        appointment_created: mode === 'appointment',
        appointment_created_at: mode === 'appointment' ? new Date().toISOString() : conversation.appointment_created_at || null,
        status: mode === 'appointment' ? 'converted' : conversation.status,
        handled_at: new Date().toISOString(),
        manager_note: form.comment || null,
      }).eq('id', conversation.id)

      await onDone()
    } catch (error) {
      console.error('Jivo action failed:', error)
      alert('Не получилось сохранить результат Jivo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>Разобрать Jivo-диалог</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="rounded-3xl border bg-slate-50 p-4">
            <div className="text-lg font-semibold text-slate-950">{conversation?.client_name || 'Клиент из Jivo'}</div>
            <div className="mt-1 text-sm text-slate-500">
              {conversation?.client_phone || 'телефон не указан'} · {conversation?.manager_name || 'менеджер не определен'} · {jivoChannelLabels[conversation?.channel] || 'Jivo'}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-5">
            {Object.entries(outcomeLabels).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                variant={mode === key ? 'default' : 'outline'}
                className={mode === key ? 'rounded-2xl bg-teal-600 hover:bg-teal-700' : 'rounded-2xl bg-white'}
                onClick={() => setMode(key)}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{mode === 'appointment' ? 'Пациент' : 'Если это уже пациент'}</Label>
              <Select value={form.patient_id || 'new'} onValueChange={(patient_id) => {
                const patient = patients.find((item: any) => item.id === patient_id)
                setForm({ ...form, patient_id: patient_id === 'new' ? '' : patient_id, patient_name: patient?.full_name || form.patient_name, phone: patient?.phone || form.phone })
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">{mode === 'appointment' ? 'Создать нового пациента' : 'Не пациент пока'}</SelectItem>
                  {patients.map((patient: any) => <SelectItem key={patient.id} value={patient.id}>{patient.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Телефон</Label>
              <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{mode === 'appointment' ? 'Имя пациента' : 'Имя клиента'}</Label>
              <Input value={form.patient_name} onChange={(event) => setForm({ ...form, patient_name: event.target.value })} />
            </div>
          </div>

          {mode === 'appointment' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Филиал</Label>
                <Select value={form.clinic_id} onValueChange={(clinic_id) => setForm({ ...form, clinic_id })}>
                  <SelectTrigger><SelectValue placeholder="Филиал" /></SelectTrigger>
                  <SelectContent>{clinics.map((clinic: any) => <SelectItem key={clinic.id} value={clinic.id}>{clinic.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Врач</Label>
                <Select value={form.doctor_id} onValueChange={(doctor_id) => setForm({ ...form, doctor_id })}>
                  <SelectTrigger><SelectValue placeholder="Врач" /></SelectTrigger>
                  <SelectContent>{doctors.map((doctor: any) => <SelectItem key={doctor.id} value={doctor.id}>{doctor.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Дата</Label>
                <Input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
              </div>
              <div className="grid grid-cols-[1fr_120px] gap-2">
                <div className="space-y-2">
                  <Label>Время</Label>
                  <Input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Мин.</Label>
                  <Select value={form.duration} onValueChange={(duration) => setForm({ ...form, duration })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30</SelectItem>
                      <SelectItem value="60">60</SelectItem>
                      <SelectItem value="90">90</SelectItem>
                      <SelectItem value="120">120</SelectItem>
                      <SelectItem value="180">180</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Услуга</Label>
                <Input value={form.service_name} onChange={(event) => setForm({ ...form, service_name: event.target.value })} />
              </div>
            </div>
          ) : mode !== 'rejected' ? (
            <div className="space-y-2">
              <Label>Когда напомнить менеджеру</Label>
              <Input type="datetime-local" value={form.task_due} onChange={(event) => setForm({ ...form, task_due: event.target.value })} />
            </div>
          ) : (
            <div className="rounded-3xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
              Отказ будет сохранен в истории пациента и KPI Jivo, но задача менеджеру не создается.
            </div>
          )}

          <div className="space-y-2">
            <Label>Комментарий менеджера</Label>
            <Textarea
              value={form.comment}
              onChange={(event) => setForm({ ...form, comment: event.target.value })}
              placeholder="Что сказал пациент, что обещали, почему думает или когда перезвонить..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button type="button" onClick={handleSave} disabled={saving} className="bg-teal-600 hover:bg-teal-700">
            {saving ? 'Сохраняю...' : 'Сохранить результат'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function OwnerControlCard({ icon: Icon, label, value, hint, tone = 'teal' }: any) {
  const tones: Record<string, string> = {
    teal: 'bg-teal-50 text-teal-700',
    sky: 'bg-sky-50 text-sky-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
  }

  return (
    <Card className="crm-panel border-0">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div>
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-semibold leading-none text-slate-950">{value}</div>
          <div className="mt-2 text-xs text-slate-500">{hint}</div>
        </div>
        <div className={`rounded-2xl p-3 ${tones[tone] || tones.teal}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function KpiCard({ icon: Icon, label, value, hint, tone = 'slate' }: any) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    teal: 'bg-teal-50 text-teal-700',
    sky: 'bg-sky-50 text-sky-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  }

  return (
    <Card className="border-white/80 bg-white/90 shadow-sm">
      <CardContent className="flex items-start justify-between p-4">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
          <p className="mt-1 text-xs text-slate-400">{hint}</p>
        </div>
        <div className={`rounded-2xl p-3 ${tones[tone] || tones.slate}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function MiniStat({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className="rounded-2xl border bg-white px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={danger ? 'font-semibold text-rose-600' : 'font-semibold text-slate-950'}>{value}</div>
    </div>
  )
}
