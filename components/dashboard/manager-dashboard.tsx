'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, ArrowRight, BellRing, CalendarCheck, CheckCircle2, CircleDollarSign,
  Clock3, Headphones, MessageCircle, PhoneCall, Plus, Radar, Sparkles, TrendingUp, UserRoundPlus, UsersRound
} from 'lucide-react'
import { format, isPast, isSameDay, parseISO, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppointments, useJivoConversations, useLeads, useManagers, usePatients, usePayments, useTasks, useTreatmentPlans } from '@/lib/hooks'
import {
  appointmentStatuses, dateLabel, isDueToday, isInRange, isOverdue, leadStatuses,
  money, patientName, planStatuses, todayRange, tomorrowRange
} from '@/lib/crm'
import { patientFocusReason, sourceLabel } from '@/lib/patient-crm'
import { AddLeadDialog } from '@/components/leads/add-lead-dialog'
import { AddAppointmentDialog } from '@/components/appointments/add-appointment-dialog'
import { db } from '@/lib/insforge'
import { DonutChart, RadialScore } from './charts'
import { buildManagerKpi, formatSeconds } from '@/lib/manager-kpi'

const quickActions = [
  { action: 'lead', label: 'Заявка', icon: UserRoundPlus },
  { action: 'appointment', label: 'Запись', icon: CalendarCheck },
  { action: 'task', label: 'Задача', icon: CheckCircle2 },
]

export function ManagerDashboard() {
  const [leadOpen, setLeadOpen] = useState(false)
  const [appointmentOpen, setAppointmentOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const { leads, mutate: mutateLeads } = useLeads()
  const { patients } = usePatients()
  const { appointments, mutate: mutateAppointments } = useAppointments()
  const { tasks, mutate: mutateTasks } = useTasks()
  const { plans } = useTreatmentPlans()
  const { payments } = usePayments()
  const { conversations } = useJivoConversations()
  const { managers } = useManagers()

  const today = todayRange()
  const tomorrow = tomorrowRange()
  const openTasks = tasks.filter((task: any) => task.status !== 'done' && task.status !== 'cancelled')
  const todayTasks = openTasks.filter((task: any) => isDueToday(task.due_at))
  const overdueTasks = openTasks.filter((task: any) => isOverdue(task.due_at))
  const todayAppointments = appointments.filter((appt: any) => isInRange(appt.start_time, today.start, today.end))
  const tomorrowAppointments = appointments.filter((appt: any) => isInRange(appt.start_time, tomorrow.start, tomorrow.end))
  const noShows = appointments.filter((appt: any) => appt.status === 'no_show' || appt.status === 'cancelled')
  const thinkingPatients = [
    ...patients.filter((patient: any) => patient.status === 'thinking'),
    ...leads.filter((lead: any) => lead.status === 'thinking'),
  ]
  const patientsToProcess = patients
    .map((patient: any) => ({ ...patient, focusReason: patientFocusReason(patient) }))
    .filter((patient: any) => Boolean(patient.focusReason))
  const freshLeads = leads.filter((lead: any) => lead.status === 'new')
  const todayPayments = payments
    .filter((payment: any) => isInRange(payment.paid_at || payment.created_at, today.start, today.end))
    .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0)
  const planPipeline = plans
    .filter((plan: any) => !['completed', 'declined'].includes(plan.status))
    .reduce((sum: number, plan: any) => sum + Number(plan.amount || 0), 0)
  const conversion = leads.length ? Math.round((leads.filter((lead: any) => ['scheduled', 'came', 'converted'].includes(lead.status)).length / leads.length) * 100) : 0
  const managerKpi = buildManagerKpi({ range: 'today', managers, conversations, leads, appointments, payments })
  const weekDays = Array.from({ length: 7 }, (_, index) => subDays(new Date(), 6 - index))
  const uniqueJivoConversations = Array.from(new Map(conversations.map((item: any) => [item.jivo_chat_id || item.id, item])).values())
  const leadTrendRaw = weekDays.map((day) => leads.filter((lead: any) => lead.created_at && isSameDay(parseISO(lead.created_at), day)).length)
  const jivoTrendRaw = weekDays.map((day) => uniqueJivoConversations.filter((item: any) => {
    const date = item.started_at || item.created_at
    return date && isSameDay(parseISO(date), day)
  }).length)
  const trendLabels = weekDays.map((day) => format(day, 'EEEEE', { locale: ru }).toUpperCase())
  const requestTrend = weekDays.map((day, index) => ({
    date: day,
    label: format(day, 'd MMM', { locale: ru }),
    shortLabel: trendLabels[index],
    leads: leadTrendRaw[index],
    jivo: jivoTrendRaw[index],
    value: leadTrendRaw[index] + jivoTrendRaw[index],
  }))
  const previousWeekDays = Array.from({ length: 7 }, (_, index) => subDays(new Date(), 13 - index))
  const previousRequests = previousWeekDays.reduce((sum, day) => {
    const crm = leads.filter((lead: any) => lead.created_at && isSameDay(parseISO(lead.created_at), day)).length
    const jivo = uniqueJivoConversations.filter((item: any) => {
      const date = item.started_at || item.created_at
      return date && isSameDay(parseISO(date), day)
    }).length
    return sum + crm + jivo
  }, 0)
  const requestTotal = requestTrend.reduce((sum, item) => sum + item.value, 0)
  const requestToday = requestTrend[requestTrend.length - 1]?.value || 0
  const requestBestDay = requestTrend.reduce((best, item) => item.value > best.value ? item : best, requestTrend[0])
  const requestDelta = previousRequests ? Math.round(((requestTotal - previousRequests) / previousRequests) * 100) : null
  const sourceColors = ['#14b8a6', '#38bdf8', '#22c55e', '#a78bfa', '#f59e0b', '#fb7185']
  const sourceCounts = [...leads, ...patients].reduce((acc: Record<string, number>, item: any) => {
    const key = item.source || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const sourceSegments = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key, value], index) => ({ label: sourceLabel(key), value, color: sourceColors[index % sourceColors.length] }))
  const appointmentSegments = [
    { label: 'План', value: appointments.filter((appt: any) => appt.status === 'planned').length, color: '#38bdf8' },
    { label: 'Подтвержден', value: appointments.filter((appt: any) => appt.status === 'confirmed').length, color: '#14b8a6' },
    { label: 'На приеме', value: appointments.filter((appt: any) => appt.status === 'in_progress').length, color: '#f59e0b' },
    { label: 'Завершен', value: appointments.filter((appt: any) => appt.status === 'completed').length, color: '#22c55e' },
  ]
  const clinicLoad = buildClinicLoad(appointments)

  const metrics = [
    { label: 'Новые заявки', value: freshLeads.length, icon: Radar, tone: 'bg-cyan-50 text-cyan-700', href: '/leads' },
    { label: 'Задачи сегодня', value: todayTasks.length, icon: CheckCircle2, tone: 'bg-teal-50 text-teal-700', href: '/tasks' },
    { label: 'Просрочено', value: overdueTasks.length, icon: AlertTriangle, tone: 'bg-rose-50 text-rose-700', href: '/tasks' },
    { label: 'Оплаты сегодня', value: money(todayPayments).replace(' MDL', ''), unit: 'MDL', icon: CircleDollarSign, tone: 'bg-amber-50 text-amber-700', href: '/payments' },
    { label: 'Пациенты сегодня', value: patientsToProcess.length, icon: BellRing, tone: 'bg-violet-50 text-violet-700', href: '/patients' },
    { label: 'Ответ Jivo', value: formatSeconds(managerKpi.totals.avgResponseSeconds).replace(' мин ', ':').replace(' сек', '').replace(' мин', ':00'), unit: 'мин', icon: Headphones, tone: 'bg-sky-50 text-sky-700', href: '/kpi' },
  ]

  return (
    <div className="space-y-4 animate-soft-in md:space-y-7">
      <section className="relative overflow-hidden rounded-[1.5rem] border border-white/80 bg-gradient-to-br from-white via-cyan-50 to-emerald-50 px-4 py-4 shadow-[0_20px_55px_rgba(15,118,110,0.09)] md:rounded-[1.75rem] md:px-6 md:py-6">
        <div className="absolute right-7 top-7 hidden h-24 w-24 rounded-full border-[14px] border-teal-100/60 lg:block" />
        <div className="absolute -bottom-8 right-28 hidden h-24 w-24 rounded-full bg-sky-200/25 blur-2xl lg:block" />
        <div className="relative z-10 grid gap-5 xl:grid-cols-[1fr_auto] xl:items-end">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-white/85 px-3 py-1 text-[11px] font-semibold text-teal-700 shadow-sm md:text-xs">
              <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4" />
              Рабочий центр менеджера
            </div>
            <h1 className="flex flex-wrap items-center gap-2 text-[2rem] font-semibold leading-none tracking-normal md:gap-3 md:text-[3.15rem]">
              <span className="bg-gradient-to-r from-slate-950 via-teal-800 to-sky-700 bg-clip-text text-transparent">
                LIFE DENTAL
              </span>
              <span className="rounded-xl border border-teal-100 bg-white/80 px-2.5 py-1.5 text-base font-semibold text-teal-700 shadow-sm md:rounded-2xl md:px-3 md:py-2 md:text-2xl">
                CRM
              </span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-5 text-slate-600 md:text-base md:leading-6">
              Заявки, визиты, перезвоны, планы лечения и оплаты в одном спокойном рабочем пространстве.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-1.5 rounded-[1.2rem] border border-white/80 bg-white/70 p-1.5 shadow-sm md:gap-2 md:rounded-[1.35rem] md:p-2 xl:min-w-[520px]">
          {quickActions.map((action) => (
            <Button
              key={action.action}
              className="h-10 rounded-2xl bg-gradient-to-r from-teal-500 to-sky-500 px-2 text-xs text-white shadow-lg shadow-teal-500/20 hover:from-teal-600 hover:to-sky-600 md:h-11 md:px-4 md:text-sm"
              onClick={() => {
                if (action.action === 'lead') setLeadOpen(true)
                if (action.action === 'appointment') setAppointmentOpen(true)
                if (action.action === 'task') setTaskOpen(true)
              }}
            >
              <action.icon className="mr-1.5 h-3.5 w-3.5 shrink-0 md:mr-2 md:h-4 md:w-4" />
              {action.label}
            </Button>
          ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 md:gap-3 xl:grid-cols-3 2xl:grid-cols-6">
        {metrics.map((metric, index) => (
          <Link href={metric.href} key={metric.label} className="animate-slide-up" style={{ animationDelay: `${index * 55}ms` }}>
            <Card className="crm-panel crm-card-hover border-0">
              <CardContent className="relative min-h-[84px] overflow-hidden p-3 pr-12 md:min-h-[92px] md:p-4 md:pr-16">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-500 md:text-sm">{metric.label}</p>
                  <div className="mt-2 flex min-w-0 items-baseline gap-1.5 whitespace-nowrap text-2xl font-medium leading-none tracking-tight text-slate-950 md:mt-3 md:gap-2 md:text-3xl">
                    <span>{metric.value}</span>
                    {'unit' in metric && metric.unit ? <span className="text-[11px] font-medium text-slate-500 md:text-sm">{metric.unit}</span> : null}
                  </div>
                </div>
                <div className={`absolute right-3 top-3 rounded-2xl p-2.5 md:right-4 md:top-4 md:p-3 ${metric.tone}`}>
                  <metric.icon className="h-4 w-4 md:h-5 md:w-5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      {patientsToProcess.length > 0 && (
        <section>
          <Card className="crm-panel border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
                  <BellRing className="h-5 w-5 text-amber-600" />
                  Пациенты на обработку сегодня
                </CardTitle>
                <p className="text-sm text-slate-500">Перезвонить, вернуть на осмотр, поздравить или дожать план лечения.</p>
              </div>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/patients">Все пациенты <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {patientsToProcess.slice(0, 6).map((patient: any) => (
                <Link key={patient.id} href={`/patients/${patient.id}`} className="rounded-2xl border bg-white p-4 shadow-sm transition hover:border-amber-200 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{patient.full_name}</div>
                      <div className="mt-1 text-sm text-slate-500">{patient.phone || sourceLabel(patient.source)}</div>
                    </div>
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{patient.focusReason}</Badge>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="crm-panel border-0">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
                  <TrendingUp className="h-5 w-5 text-teal-600" />
                  Динамика заявок
                </CardTitle>
                <p className="text-sm text-slate-500">Реальные обращения за 7 дней: заявки CRM + диалоги Jivo.</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-2xl border bg-white px-3 py-2">
                  <div className="text-xs text-slate-500">7 дней</div>
                  <div className="font-semibold text-slate-950">{requestTotal}</div>
                </div>
                <div className="rounded-2xl border bg-white px-3 py-2">
                  <div className="text-xs text-slate-500">Сегодня</div>
                  <div className="font-semibold text-teal-700">{requestToday}</div>
                </div>
                <div className="rounded-2xl border bg-white px-3 py-2">
                  <div className="text-xs text-slate-500">К прошлой</div>
                  <div className={requestDelta == null ? 'font-semibold text-slate-400' : requestDelta >= 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-600'}>
                    {requestDelta == null ? '-' : `${requestDelta > 0 ? '+' : ''}${requestDelta}%`}
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <RequestDynamicsChart data={requestTrend} bestDay={requestBestDay} />
          </CardContent>
        </Card>

        <Card className="crm-panel border-0">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">Источники заявок</CardTitle>
            <p className="text-sm text-slate-500">Кольцевая диаграмма каналов привлечения.</p>
          </CardHeader>
          <CardContent>
            <DonutChart segments={sourceSegments} centerLabel="контактов" centerValue={leads.length + patients.length} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="crm-panel border-0">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">Загрузка клиники</CardTitle>
            <p className="text-sm text-slate-500">Активные записи: в какие дни и часы клиника загружена сильнее.</p>
          </CardHeader>
          <CardContent>
            <ClinicLoadWidget data={clinicLoad} />
          </CardContent>
        </Card>

        <Card className="crm-panel border-0">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">Клинический пульс</CardTitle>
            <p className="text-sm text-slate-500">Короткая аналитика по конверсии и статусам визитов.</p>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-[auto_1fr]">
            <div className="flex items-center justify-center">
              <RadialScore value={conversion} label="конверсия" />
            </div>
            <DonutChart segments={appointmentSegments} centerLabel="визитов" centerValue={appointments.length} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="crm-panel border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
                Сегодня в клинике
              </CardTitle>
              <p className="text-sm text-slate-500">Записи, которые менеджеру важно держать на радаре.</p>
            </div>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/schedule">Расписание <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayAppointments.length === 0 ? (
              <EmptyState label="На сегодня записей нет" />
            ) : todayAppointments.slice(0, 7).map((appt: any) => {
              const status = appointmentStatuses[appt.status] || appointmentStatuses.planned
              return (
                <div key={appt.id} className="flex items-center gap-4 rounded-2xl border bg-white p-3 shadow-sm transition hover:border-blue-200">
                  <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-sky-500 text-sm font-semibold text-white">
                    {dateLabel(appt.start_time, 'HH:mm')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-slate-900">{patientName(appt, patients)}</div>
                    <div className="truncate text-sm text-slate-500">{appt.service_name || 'Консультация'}</div>
                  </div>
                  <Badge variant="outline" className={status.tone}>{status.label}</Badge>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <div className="grid gap-5">
          <Card className="crm-panel border-0">
            <CardHeader>
              <CardTitle className="text-xl text-slate-950">Воронка</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-4xl font-semibold text-slate-950">{conversion}%</div>
                  <p className="text-sm text-slate-500">конверсия заявок в запись</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-slate-950">{money(planPipeline)}</div>
                  <p className="text-sm text-slate-500">планов в работе</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {['new', 'contacted', 'thinking', 'scheduled'].map((statusKey) => {
                  const status = leadStatuses[statusKey]
                  const count = leads.filter((lead: any) => lead.status === statusKey).length
                  return (
                    <div key={statusKey} className="rounded-xl bg-gradient-to-br from-cyan-50 to-white p-3 text-center">
                      <div className="text-xl font-semibold text-slate-950">{count}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{status.label}</div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="crm-panel border-0">
            <CardHeader>
              <CardTitle className="text-xl text-slate-950">Нужно внимание</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <AttentionRow icon={PhoneCall} label="Новые заявки" value={freshLeads.length} href="/leads" />
              <AttentionRow icon={Clock3} label="Просроченные задачи" value={overdueTasks.length} href="/tasks" danger />
              <AttentionRow icon={MessageCircle} label="Пациенты думают" value={thinkingPatients.length} href="/treatment-plans" />
              <AttentionRow icon={UsersRound} label="Не пришли / отмены" value={noShows.length} href="/appointments" />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <MiniList title="Заявки" href="/leads" items={freshLeads.slice(0, 5)} render={(lead: any) => (
          <>
            <div className="font-semibold text-slate-900">{lead.name}</div>
            <div className="text-sm text-slate-500">{lead.phone || lead.email || 'Контакт не указан'}</div>
          </>
        )} />
        <MiniList title="Задачи" href="/tasks" items={openTasks.slice(0, 5)} render={(task: any) => (
          <>
            <div className="font-semibold text-slate-900">{task.title}</div>
            <div className={`text-sm ${isPast(parseISO(task.due_at || new Date().toISOString())) ? 'text-rose-500' : 'text-slate-500'}`}>
              {task.due_at ? dateLabel(task.due_at) : 'Без дедлайна'}
            </div>
          </>
        )} />
        <MiniList title="Планы лечения" href="/treatment-plans" items={plans.slice(0, 5)} render={(plan: any) => {
          const status = planStatuses[plan.status] || planStatuses.proposed
          return (
            <>
              <div className="font-semibold text-slate-900">{plan.title}</div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                {money(plan.amount)}
                <Badge variant="outline" className={status.tone}>{status.label}</Badge>
              </div>
            </>
          )
        }} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="crm-panel border-0">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Записи завтра</p>
            <div className="mt-2 text-3xl font-semibold">{tomorrowAppointments.length}</div>
          </CardContent>
        </Card>
        <Card className="crm-panel border-0">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Всего пациентов</p>
            <div className="mt-2 text-3xl font-semibold">{patients.length}</div>
          </CardContent>
        </Card>
        <Card className="crm-panel border-0">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Активных планов</p>
            <div className="mt-2 text-3xl font-semibold">{plans.filter((plan: any) => !['completed', 'declined'].includes(plan.status)).length}</div>
          </CardContent>
        </Card>
      </section>

      <AddLeadDialog
        open={leadOpen}
        onOpenChange={setLeadOpen}
        onSuccess={() => {
          mutateLeads()
          setLeadOpen(false)
        }}
      />
      <AddAppointmentDialog
        open={appointmentOpen}
        onOpenChange={setAppointmentOpen}
        onSuccess={() => {
          mutateAppointments()
          setAppointmentOpen(false)
        }}
      />
      <QuickTaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        onSuccess={() => {
          mutateTasks()
          setTaskOpen(false)
        }}
      />
    </div>
  )
}

function QuickTaskDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void }) {
  const { patients } = usePatients()
  const { leads } = useLeads()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    due_at: '',
    priority: 'normal',
    patient_id: 'none',
    lead_id: 'none',
  })

  const handleSubmit = async () => {
    if (!form.title.trim()) return
    setLoading(true)
    try {
      await db.from('tasks').insert([{
        title: form.title,
        description: form.description || null,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        priority: form.priority,
        patient_id: form.patient_id === 'none' ? null : form.patient_id,
        lead_id: form.lead_id === 'none' ? null : form.lead_id,
        status: 'open',
      }])
      setForm({ title: '', description: '', due_at: '', priority: 'normal', patient_id: 'none', lead_id: 'none' })
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Быстрая задача</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Что сделать</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Позвонить пациенту, подтвердить визит..."
            />
          </div>
          <div className="grid gap-2">
            <Label>Контекст</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Что обещали, что уточнить, чем закончился разговор"
              rows={3}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Дедлайн</Label>
              <Input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Приоритет</Label>
              <Select value={form.priority} onValueChange={(priority) => setForm({ ...form, priority })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Низкий</SelectItem>
                  <SelectItem value="normal">Обычный</SelectItem>
                  <SelectItem value="high">Высокий</SelectItem>
                  <SelectItem value="urgent">Срочно</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Пациент</Label>
              <Select value={form.patient_id} onValueChange={(patient_id) => setForm({ ...form, patient_id })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не привязано</SelectItem>
                  {patients.map((patient: any) => <SelectItem key={patient.id} value={patient.id}>{patient.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Заявка</Label>
              <Select value={form.lead_id} onValueChange={(lead_id) => setForm({ ...form, lead_id })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не привязано</SelectItem>
                  {leads.map((lead: any) => <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-gradient-to-r from-teal-500 to-sky-500 text-white hover:from-teal-600 hover:to-sky-600">
            {loading ? 'Сохраняю...' : 'Создать задачу'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AttentionRow({ icon: Icon, label, value, href, danger = false }: any) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-2xl border bg-white p-3 transition hover:border-blue-200 hover:shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`rounded-xl p-2 ${danger ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="font-medium text-slate-700">{label}</span>
      </div>
      <span className={`text-lg font-semibold ${danger && value > 0 ? 'text-rose-600' : 'text-slate-950'}`}>{value}</span>
    </Link>
  )
}

const clinicDayOrder = [
  { index: 1, label: 'Пн' },
  { index: 2, label: 'Вт' },
  { index: 3, label: 'Ср' },
  { index: 4, label: 'Чт' },
  { index: 5, label: 'Пт' },
  { index: 6, label: 'Сб' },
  { index: 0, label: 'Вс' },
]
const clinicHourSlots = Array.from({ length: 15 }, (_, index) => 7 + index)
const activeAppointmentStatuses = new Set(['planned', 'confirmed', 'in_progress', 'completed'])

function parseAppointmentDate(appointment: any) {
  const raw = appointment?.start_time || appointment?.start_at
  if (!raw) return null
  const date = parseISO(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function buildClinicLoad(appointments: any[]) {
  const dayCounts = clinicDayOrder.map((day) => ({ ...day, value: 0 }))
  const hourCounts = clinicHourSlots.map((hour) => ({ hour, value: 0 }))
  const heatmap = clinicDayOrder.map((day) => ({
    ...day,
    hours: clinicHourSlots.map((hour) => ({ hour, value: 0 })),
  }))

  appointments.forEach((appointment) => {
    if (!activeAppointmentStatuses.has(appointment.status || 'planned')) return
    const date = parseAppointmentDate(appointment)
    if (!date) return

    const dayIndex = date.getDay()
    const hour = date.getHours()
    const day = dayCounts.find((item) => item.index === dayIndex)
    const hourItem = hourCounts.find((item) => item.hour === hour)
    const heatDay = heatmap.find((item) => item.index === dayIndex)

    if (day) day.value += 1
    if (hourItem) hourItem.value += 1
    const heatHour = heatDay?.hours.find((item) => item.hour === hour)
    if (heatHour) heatHour.value += 1
  })

  const total = dayCounts.reduce((sum, item) => sum + item.value, 0)
  const maxDay = dayCounts.reduce((max, item) => Math.max(max, item.value), 0)
  const maxHour = hourCounts.reduce((max, item) => Math.max(max, item.value), 0)
  const busiestDay = dayCounts.reduce((best, item) => item.value > best.value ? item : best, dayCounts[0])
  const busiestHour = hourCounts.reduce((best, item) => item.value > best.value ? item : best, hourCounts[0])

  return { dayCounts, hourCounts, heatmap, total, maxDay, maxHour, busiestDay, busiestHour }
}

function ClinicLoadWidget({ data }: { data: ReturnType<typeof buildClinicLoad> }) {
  const hasData = data.total > 0
  const topHours = [...data.hourCounts].sort((a, b) => b.value - a.value).slice(0, 3).filter((item) => item.value > 0)

  if (!hasData) {
    return (
      <div className="rounded-3xl border border-dashed bg-white/70 p-8 text-center">
        <div className="text-sm font-medium text-slate-700">Пока нет активных записей</div>
        <div className="mt-1 text-sm text-slate-500">Когда появятся записи, здесь будет реальная загрузка по дням и часам.</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <LoadSummary label="активных" value={data.total} />
        <LoadSummary label="пик день" value={data.busiestDay.value ? data.busiestDay.label : '-'} hint={data.busiestDay.value ? `${data.busiestDay.value} зап.` : undefined} />
        <LoadSummary label="пик час" value={data.busiestHour.value ? `${String(data.busiestHour.hour).padStart(2, '0')}:00` : '-'} hint={data.busiestHour.value ? `${data.busiestHour.value} зап.` : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-2 rounded-3xl bg-white/70 p-3">
          {data.dayCounts.map((day) => {
            const width = data.maxDay ? Math.max(8, (day.value / data.maxDay) * 100) : 0
            return (
              <div key={day.label} className="grid grid-cols-[32px_1fr_34px] items-center gap-2 text-sm">
                <span className="font-medium text-slate-500">{day.label}</span>
                <div className="h-8 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-sky-400 shadow-sm transition-all duration-500"
                    style={{ width: day.value ? `${width}%` : '0%' }}
                  />
                </div>
                <span className="text-right font-semibold text-slate-900">{day.value}</span>
              </div>
            )
          })}
        </div>

        <div className="rounded-3xl border bg-white/75 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">Часы загрузки</div>
              <div className="text-xs text-slate-500">
                {topHours.length ? topHours.map((item) => `${String(item.hour).padStart(2, '0')}:00`).join(', ') : 'пиков пока нет'}
              </div>
            </div>
            <Badge variant="outline" className="rounded-full border-teal-200 bg-teal-50 text-teal-700">по времени записи</Badge>
          </div>
          <div className="overflow-x-auto pb-1">
            <div className="min-w-[460px] space-y-1">
              <div className="grid grid-cols-[34px_repeat(15,minmax(22px,1fr))] gap-1 text-[10px] font-medium text-slate-400">
                <span />
                {clinicHourSlots.map((hour) => <span key={hour} className="text-center">{hour}</span>)}
              </div>
              {data.heatmap.map((day) => (
                <div key={day.label} className="grid grid-cols-[34px_repeat(15,minmax(22px,1fr))] gap-1">
                  <span className="py-1 text-xs font-semibold text-slate-500">{day.label}</span>
                  {day.hours.map((hour) => (
                    <div
                      key={`${day.label}-${hour.hour}`}
                      className="h-6 rounded-lg border border-white"
                      title={`${day.label}, ${String(hour.hour).padStart(2, '0')}:00 - ${hour.value} записей`}
                      style={{ backgroundColor: clinicLoadColor(hour.value, data.maxHour) }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadSummary({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-white/80 px-3 py-2">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-lg font-semibold leading-none text-slate-950">{value}</span>
        {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
      </div>
    </div>
  )
}

function clinicLoadColor(value: number, max: number) {
  if (!value || !max) return '#f8fafc'
  const opacity = 0.18 + (value / max) * 0.68
  return `rgba(20, 184, 166, ${opacity})`
}

function RequestDynamicsChart({ data, bestDay }: { data: any[]; bestDay: any }) {
  const width = 760
  const height = 250
  const padding = { top: 22, right: 26, bottom: 50, left: 42 }
  const max = Math.max(1, ...data.map((item) => item.value))
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const points = data.map((item, index) => {
    const x = padding.left + (data.length > 1 ? (plotWidth / (data.length - 1)) * index : plotWidth / 2)
    const y = padding.top + plotHeight - (item.value / max) * plotHeight
    return { ...item, x, y }
  })
  const line = points.map((point) => `${point.x},${point.y}`).join(' ')
  const area = `${padding.left},${height - padding.bottom} ${line} ${width - padding.right},${height - padding.bottom}`
  const hasData = data.some((item) => item.value > 0)
  const gridValues = [1, 0.66, 0.33]

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-teal-100 bg-gradient-to-br from-white via-cyan-50/70 to-teal-50/80 p-4">
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-white/80 px-3 py-2">
          <div className="text-xs text-slate-500">CRM-заявки</div>
          <div className="text-lg font-semibold text-slate-950">{data.reduce((sum, item) => sum + item.leads, 0)}</div>
        </div>
        <div className="rounded-2xl bg-white/80 px-3 py-2">
          <div className="text-xs text-slate-500">Jivo-обращения</div>
          <div className="text-lg font-semibold text-sky-700">{data.reduce((sum, item) => sum + item.jivo, 0)}</div>
        </div>
        <div className="rounded-2xl bg-white/80 px-3 py-2">
          <div className="text-xs text-slate-500">Пиковый день</div>
          <div className="truncate text-lg font-semibold text-teal-700">{bestDay?.value ? `${bestDay.label}: ${bestDay.value}` : '-'}</div>
        </div>
      </div>

      <div className="relative min-h-[250px]">
        {!hasData && (
          <div className="absolute inset-0 z-10 grid place-items-center rounded-3xl border border-dashed border-teal-200 bg-white/75 text-center">
            <div>
              <div className="text-base font-semibold text-slate-800">За 7 дней заявок нет</div>
              <div className="mt-1 text-sm text-slate-500">Когда появятся заявки CRM или Jivo, график заполнится автоматически.</div>
            </div>
          </div>
        )}
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[250px] w-full">
          <defs>
            <linearGradient id="requestAreaFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.30" />
              <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <filter id="requestLineGlow" x="-20%" y="-30%" width="140%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {gridValues.map((ratio) => {
            const y = padding.top + plotHeight - ratio * plotHeight
            const label = Math.round(max * ratio)
            return (
              <g key={ratio}>
                <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#dbeafe" strokeDasharray="6 9" />
                <text x={padding.left - 12} y={y + 4} textAnchor="end" className="fill-slate-400 text-[12px]">{label}</text>
              </g>
            )
          })}
          <polygon points={area} fill="url(#requestAreaFill)" />
          <polyline points={line} fill="none" stroke="#0f766e" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" filter="url(#requestLineGlow)" />
          <polyline points={line} fill="none" stroke="#67e8f9" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point) => (
            <g key={point.label}>
              <line x1={point.x} x2={point.x} y1={padding.top} y2={height - padding.bottom} stroke="#e2e8f0" strokeWidth="1" opacity="0.55" />
              <circle cx={point.x} cy={point.y} r={point.value ? 7 : 5} fill="#fff" stroke={point.value ? '#0f766e' : '#cbd5e1'} strokeWidth="3" />
              {point.value > 0 && (
                <text x={point.x} y={point.y - 14} textAnchor="middle" className="fill-slate-900 text-[13px] font-semibold">{point.value}</text>
              )}
              <text x={point.x} y={height - 23} textAnchor="middle" className="fill-slate-500 text-[12px] font-semibold">{point.shortLabel}</text>
              <text x={point.x} y={height - 8} textAnchor="middle" className="fill-slate-400 text-[11px]">{point.label}</text>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-teal-500" /> всего заявок</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Jivo входит в общий счет</span>
        </div>
        <span>Считается по дате создания заявки или началу Jivo-диалога</span>
      </div>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-white/70 p-8 text-center text-sm text-slate-500">{label}</div>
  )
}

function MiniList({ title, href, items, render }: any) {
  return (
    <Card className="crm-panel border-0">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg text-slate-950">{title}</CardTitle>
        <Button asChild variant="ghost" size="sm" className="rounded-xl">
          <Link href={href}>Открыть</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? <EmptyState label="Пока пусто" /> : items.map((item: any) => (
          <div key={item.id} className="rounded-2xl border bg-white p-3 shadow-sm">
            {render(item)}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
