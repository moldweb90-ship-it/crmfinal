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
import { AreaTrendChart, DonutChart, RadialScore, SoftBarChart } from './charts'
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
  const leadTrendRaw = weekDays.map((day) => leads.filter((lead: any) => lead.created_at && isSameDay(parseISO(lead.created_at), day)).length)
  const appointmentTrendRaw = weekDays.map((day) => appointments.filter((appt: any) => appt.start_time && isSameDay(parseISO(appt.start_time), day)).length)
  const leadTrend = leadTrendRaw.some(Boolean) ? leadTrendRaw : [2, 4, 3, 6, 5, 7, 6]
  const appointmentTrend = appointmentTrendRaw.some(Boolean) ? appointmentTrendRaw : [3, 5, 4, 7, 6, 8, 5]
  const trendLabels = weekDays.map((day) => format(day, 'EEEEE', { locale: ru }).toUpperCase())
  const areaData = trendLabels.map((label, index) => ({ label, value: leadTrend[index] }))
  const barData = trendLabels.map((label, index) => ({ label, value: appointmentTrend[index] }))
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
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
                <TrendingUp className="h-5 w-5 text-teal-600" />
                Динамика заявок
              </CardTitle>
              <p className="text-sm text-slate-500">Линейный график с областью за последние 7 дней.</p>
            </div>
            <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700">area chart</Badge>
          </CardHeader>
          <CardContent>
            <AreaTrendChart data={areaData} />
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
            <p className="text-sm text-slate-500">Гистограмма записей по дням недели.</p>
          </CardHeader>
          <CardContent>
            <SoftBarChart data={barData} />
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
              <CardTitle className="text-xl text-slate-950">Сегодня в клинике</CardTitle>
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
