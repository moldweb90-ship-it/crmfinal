'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  BellRing,
  CalendarClock,
  CalendarDays,
  Cake,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  Eye,
  Filter,
  MessageCircle,
  MoreHorizontal,
  Phone,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
  WalletCards,
} from 'lucide-react'
import { addDays, format, isAfter, isBefore, isSameDay, parseISO, startOfDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { db } from '@/lib/insforge'
import { useAppointments, usePatients, useTasks } from '@/lib/hooks'
import {
  birthdayLabel,
  dateOnly,
  isBirthdaySoon,
  isDateTodayOrOverdue,
  patientFocusReason,
  patientSources,
  patientStatusLabels,
  sourceLabel,
} from '@/lib/patient-crm'
import { money } from '@/lib/crm'
import { cn } from '@/lib/utils'

const statusOptions = [
  { value: 'active', label: 'Активный' },
  { value: 'needs_follow_up', label: 'Нужен контакт' },
  { value: 'thinking', label: 'Думает' },
  { value: 'checkup_due', label: 'Плановый осмотр' },
  { value: 'inactive', label: 'Спящий' },
]

const segmentOptions = [
  { value: 'all', label: 'Все' },
  { value: 'focus', label: 'К действию' },
  { value: 'followup', label: 'Связаться' },
  { value: 'checkup', label: 'Осмотры' },
  { value: 'debt', label: 'Долги' },
  { value: 'birthday', label: 'Дни рождения' },
  { value: 'thinking', label: 'Думают' },
]

const sortOptions = [
  { value: 'next_step', label: 'Сначала ближайшие' },
  { value: 'last_visit', label: 'Последний визит' },
  { value: 'spent', label: 'Сумма оплат' },
  { value: 'debt', label: 'Долг' },
  { value: 'name', label: 'По имени' },
]

export function PatientTable() {
  const { patients, isLoading, mutate } = usePatients()
  const { appointments } = useAppointments()
  const { tasks, mutate: mutateTasks } = useTasks()
  const [searchTerm, setSearchTerm] = useState('')
  const [segment, setSegment] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [sortBy, setSortBy] = useState('next_step')

  const today = startOfDay(new Date())

  const patientMetrics = useMemo(() => {
    const appointmentMap = new Map<string, any[]>()
    const taskMap = new Map<string, any[]>()

    appointments.forEach((appointment: any) => {
      if (!appointment.patient_id) return
      appointmentMap.set(appointment.patient_id, [...(appointmentMap.get(appointment.patient_id) || []), appointment])
    })

    tasks.forEach((task: any) => {
      if (!task.patient_id) return
      taskMap.set(task.patient_id, [...(taskMap.get(task.patient_id) || []), task])
    })

    return { appointmentMap, taskMap }
  }, [appointments, tasks])

  const enrichedPatients = useMemo(() => {
    return patients.map((patient: any) => {
      const patientAppointments = patientMetrics.appointmentMap.get(patient.id) || []
      const patientTasks = patientMetrics.taskMap.get(patient.id) || []
      const activeTasks = patientTasks.filter((task: any) => !['done', 'cancelled'].includes(task.status))
      const nextAppointment = patientAppointments
        .filter((appointment: any) => appointment.start_time && !['completed', 'cancelled', 'no_show'].includes(appointment.status))
        .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0]
      const lastAppointment = patientAppointments
        .filter((appointment: any) => appointment.start_time && isBefore(parseISO(appointment.start_time), addDays(today, 1)))
        .sort((a: any, b: any) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())[0]

      return {
        ...patient,
        focus: patientFocusReason(patient),
        activeTasksCount: activeTasks.length,
        nextAppointment,
        lastAppointment,
      }
    })
  }, [patients, patientMetrics, today])

  const filteredPatients = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return enrichedPatients
      .filter((patient: any) => {
        const haystack = [
          patient.full_name,
          patient.phone,
          patient.email,
          patient.manager_notes,
          patient.notes,
          sourceLabel(patient.source),
        ].join(' ').toLowerCase()

        if (normalizedSearch && !haystack.includes(normalizedSearch)) return false
        if (statusFilter !== 'all' && patient.status !== statusFilter) return false
        if (sourceFilter !== 'all' && patient.source !== sourceFilter) return false
        if (segment === 'focus' && !patient.focus) return false
        if (segment === 'followup' && !isDateTodayOrOverdue(patient.next_follow_up_at)) return false
        if (segment === 'checkup' && !isDateTodayOrOverdue(patient.planned_checkup_at)) return false
        if (segment === 'debt' && !(Number(patient.debt || 0) > 0)) return false
        if (segment === 'birthday' && !isBirthdaySoon(patient.birth_date, 14)) return false
        if (segment === 'thinking' && patient.status !== 'thinking') return false
        return true
      })
      .sort((a: any, b: any) => {
        if (sortBy === 'name') return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ru')
        if (sortBy === 'spent') return Number(b.total_spent || 0) - Number(a.total_spent || 0)
        if (sortBy === 'debt') return Number(b.debt || 0) - Number(a.debt || 0)
        if (sortBy === 'last_visit') return dateValue(b.last_visit || b.lastAppointment?.start_time) - dateValue(a.last_visit || a.lastAppointment?.start_time)
        return nextStepValue(a) - nextStepValue(b)
      })
  }, [enrichedPatients, searchTerm, segment, statusFilter, sourceFilter, sortBy])

  const stats = [
    { label: 'Всего', value: patients.length, icon: UserRound, tone: 'bg-sky-50 text-sky-700' },
    { label: 'К действию', value: enrichedPatients.filter((patient: any) => patient.focus).length, icon: BellRing, tone: 'bg-amber-50 text-amber-700' },
    { label: 'Осмотры', value: enrichedPatients.filter((patient: any) => isDateTodayOrOverdue(patient.planned_checkup_at)).length, icon: CalendarClock, tone: 'bg-cyan-50 text-cyan-700' },
    { label: 'С долгом', value: enrichedPatients.filter((patient: any) => Number(patient.debt || 0) > 0).length, icon: CreditCard, tone: 'bg-rose-50 text-rose-700' },
    { label: 'ДР 14 дней', value: enrichedPatients.filter((patient: any) => isBirthdaySoon(patient.birth_date, 14)).length, icon: Cake, tone: 'bg-violet-50 text-violet-700' },
  ]

  const resetFilters = () => {
    setSearchTerm('')
    setSegment('all')
    setStatusFilter('all')
    setSourceFilter('all')
    setSortBy('next_step')
  }

  const updatePatient = async (patientId: string, patch: Record<string, any>) => {
    await db.from('patients').update(patch).eq('id', patientId)
    mutate()
  }

  const setFollowUp = async (patient: any, days: number) => {
    const due = addDays(new Date(), days)
    due.setHours(10, 0, 0, 0)
    await updatePatient(patient.id, {
      next_follow_up_at: due.toISOString(),
      status: 'needs_follow_up',
    })
    await db.from('tasks').insert([{
      title: `Связаться с пациентом: ${patient.full_name}`,
      description: 'Автозадача из списка пациентов. Уточнить состояние, следующий шаг и готовность к записи.',
      patient_id: patient.id,
      patient_name: patient.full_name,
      due_at: due.toISOString(),
      priority: 'normal',
      status: 'open',
      task_type: 'patient_follow_up',
      automation_key: `manual-follow-up-${patient.id}-${due.toISOString().slice(0, 10)}`,
    }])
    mutateTasks()
  }

  const markContacted = async (patient: any) => {
    await updatePatient(patient.id, {
      status: patient.status === 'needs_follow_up' ? 'active' : patient.status,
      next_follow_up_at: null,
      last_contacted_at: new Date().toISOString(),
    })
    await db.from('contact_history').insert([{
      patient_id: patient.id,
      lead_id: patient.converted_lead_id || null,
      type: patient.preferred_contact_method || 'phone',
      summary: 'Менеджер связался с пациентом',
      result: 'contacted',
      created_at: new Date().toISOString(),
    }])
  }

  const deletePatient = async (patient: any) => {
    const ok = window.confirm(`Удалить пациента "${patient.full_name}"? История записей останется в системе, но связь с карточкой пациента пропадет.`)
    if (!ok) return
    await db.from('patients').delete().eq('id', patient.id)
    mutate()
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-3xl border bg-white/80 text-slate-500">
        Загрузка пациентов...
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-soft-in">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label} className="crm-panel border-0">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="text-sm font-medium text-slate-500">{stat.label}</div>
                <div className="text-2xl font-semibold text-slate-950">{stat.value}</div>
              </div>
              <div className={cn('rounded-2xl p-3', stat.tone)}>
                <stat.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="crm-panel border-0">
        <CardContent className="space-y-4 p-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {segmentOptions.map((item) => (
              <Button
                key={item.value}
                variant={segment === item.value ? 'default' : 'outline'}
                onClick={() => setSegment(item.value)}
                className={cn(
                  'h-10 shrink-0 rounded-2xl',
                  segment === item.value ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-white',
                )}
              >
                {item.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_170px_170px_190px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Поиск: имя, телефон, источник, заметки..."
                className="h-11 rounded-2xl bg-white pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-11 rounded-2xl bg-white"><Filter className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                {statusOptions.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-11 rounded-2xl bg-white"><SelectValue placeholder="Источник" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все источники</SelectItem>
                {patientSources.map((source) => <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-11 rounded-2xl bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {sortOptions.map((sort) => <SelectItem key={sort.value} value={sort.value}>{sort.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={resetFilters} className="h-11 rounded-2xl bg-white">
              <RotateCcw className="mr-2 h-4 w-4" />
              Сброс
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="crm-panel overflow-hidden border-0">
        <CardContent className="p-0">
          <div className="hidden grid-cols-[1.25fr_150px_150px_160px_180px_120px_48px] gap-4 border-b bg-slate-50/80 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 xl:grid">
            <div>Пациент</div>
            <div>Контакт</div>
            <div>Источник</div>
            <div>Визиты</div>
            <div>Следующий шаг</div>
            <div>Финансы</div>
            <div />
          </div>

          {filteredPatients.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <UserRound className="mx-auto mb-4 h-12 w-12 text-slate-300" />
              <h3 className="text-lg font-semibold text-slate-700">Пациентов по фильтрам нет</h3>
              <p className="text-sm text-slate-400">Сбросьте фильтры или добавьте нового пациента.</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredPatients.map((patient: any) => (
                <PatientRow
                  key={patient.id}
                  patient={patient}
                  onSetStatus={(status) => updatePatient(patient.id, { status })}
                  onFollowUp={(days) => setFollowUp(patient, days)}
                  onContacted={() => markContacted(patient)}
                  onDelete={() => deletePatient(patient)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PatientRow({
  patient,
  onSetStatus,
  onFollowUp,
  onContacted,
  onDelete,
}: {
  patient: any
  onSetStatus: (status: string) => void
  onFollowUp: (days: number) => void
  onContacted: () => void
  onDelete: () => void
}) {
  const status = patientStatusLabels[patient.status || 'active'] || patientStatusLabels.active
  const focus = patient.focus
  const initials = String(patient.full_name || 'Пациент').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className={cn('grid gap-4 px-5 py-4 transition hover:bg-white/70 xl:grid-cols-[1.25fr_150px_150px_160px_180px_120px_48px]', focus && 'bg-amber-50/30')}>
      <Link href={`/patients/${patient.id}`} className="flex min-w-0 items-center gap-3">
        <Avatar className="h-12 w-12 border border-white shadow-sm">
          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(patient.full_name || 'Patient')}`} />
          <AvatarFallback className="bg-teal-500 text-white">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate font-semibold text-slate-950">{patient.full_name}</div>
            <Badge variant="outline" className={status.tone}>{status.label}</Badge>
            {patient.activeTasksCount > 0 && <Badge variant="outline" className="bg-white">{patient.activeTasksCount} задач</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
            <span><Cake className="mr-1 inline h-3 w-3" />{birthdayLabel(patient.birth_date)}</span>
            {patient.preferred_contact_method && <span>{contactMethodLabel(patient.preferred_contact_method)}</span>}
          </div>
          {patient.manager_notes && <div className="mt-1 line-clamp-1 text-xs text-slate-400">{patient.manager_notes}</div>}
        </div>
      </Link>

      <div className="flex flex-col justify-center gap-1 text-sm text-slate-600">
        <a href={patient.phone ? `tel:${patient.phone}` : undefined} className="inline-flex items-center gap-2 font-medium text-teal-700">
          <Phone className="h-4 w-4" />
          {patient.phone || 'Нет телефона'}
        </a>
        {patient.email && <span className="truncate text-xs text-slate-400">{patient.email}</span>}
      </div>

      <div className="flex items-center text-sm text-slate-600">
        <Badge variant="outline" className="bg-white">{sourceLabel(patient.source)}</Badge>
      </div>

      <div className="space-y-1 text-sm text-slate-600">
        <div><CalendarDays className="mr-1 inline h-3.5 w-3.5" />{formatDate(patient.last_visit || patient.lastAppointment?.start_time, 'Нет визитов')}</div>
        <div className="text-xs text-slate-400">Следующая: {formatDate(patient.nextAppointment?.start_time, 'не записан')}</div>
      </div>

      <div className="space-y-1">
        {focus ? (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
            <BellRing className="mr-1 h-3 w-3" />
            {focus}
          </Badge>
        ) : (
          <div className="text-sm text-slate-500">
            <Clock3 className="mr-1 inline h-3.5 w-3.5" />
            {formatDateTime(patient.next_follow_up_at, 'нет задачи')}
          </div>
        )}
        {patient.planned_checkup_at && <div className="text-xs text-slate-400">Осмотр: {formatDate(patient.planned_checkup_at)}</div>}
      </div>

      <div className="flex flex-col justify-center gap-1 text-sm">
        {Number(patient.debt || 0) > 0 ? (
          <span className="font-semibold text-rose-600"><WalletCards className="mr-1 inline h-3.5 w-3.5" />{money(patient.debt)}</span>
        ) : (
          <span className="font-medium text-emerald-600">Нет долга</span>
        )}
        <span className="text-xs text-slate-400">Всего: {money(patient.total_spent || 0)}</span>
      </div>

      <div className="flex items-center justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-xl">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem asChild>
              <Link href={`/patients/${patient.id}`}><Eye className="h-4 w-4" />Открыть карточку</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onContacted}><CheckCircle2 className="h-4 w-4" />Контакт выполнен</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onFollowUp(1)}><BellRing className="h-4 w-4" />Напомнить завтра</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFollowUp(3)}><CalendarClock className="h-4 w-4" />Напомнить через 3 дня</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFollowUp(7)}><CalendarClock className="h-4 w-4" />Напомнить через 7 дней</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSetStatus('active')}>Статус: активный</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSetStatus('thinking')}>Статус: думает</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSetStatus('needs_follow_up')}>Статус: нужен контакт</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSetStatus('inactive')}>Статус: спящий</DropdownMenuItem>
            <DropdownMenuSeparator />
            {patient.phone && (
              <DropdownMenuItem asChild>
                <a href={`https://wa.me/${normalizePhone(patient.phone)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />WhatsApp</a>
              </DropdownMenuItem>
            )}
            {patient.phone && (
              <DropdownMenuItem asChild>
                <a href={`tel:${patient.phone}`}><Phone className="h-4 w-4" />Позвонить</a>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-rose-600 focus:text-rose-600"><Trash2 className="h-4 w-4" />Удалить пациента</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Link href={`/patients/${patient.id}`} className="ml-1 hidden rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 xl:block">
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

function nextStepValue(patient: any) {
  const candidates = [patient.next_follow_up_at, patient.planned_checkup_at, patient.nextAppointment?.start_time]
    .filter(Boolean)
    .map(dateValue)
  return candidates.length ? Math.min(...candidates) : Number.MAX_SAFE_INTEGER
}

function dateValue(value?: string | null) {
  if (!value) return 0
  const date = value.includes('T') ? parseISO(value) : parseISO(dateOnly(value))
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function formatDate(value?: string | null, fallback = 'не задано') {
  if (!value) return fallback
  const date = value.includes('T') ? parseISO(value) : parseISO(dateOnly(value))
  if (Number.isNaN(date.getTime())) return fallback
  return format(date, 'd MMM yyyy', { locale: ru })
}

function formatDateTime(value?: string | null, fallback = 'не задано') {
  if (!value) return fallback
  const date = parseISO(value)
  if (Number.isNaN(date.getTime())) return fallback
  const dateText = isSameDay(date, startOfDay(new Date())) ? 'сегодня' : format(date, 'd MMM', { locale: ru })
  return `${dateText}, ${format(date, 'HH:mm')}`
}

function contactMethodLabel(value: string) {
  const labels: Record<string, string> = {
    phone: 'Телефон',
    whatsapp: 'WhatsApp',
    sms: 'SMS',
    email: 'Email',
  }
  return labels[value] || value
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d]/g, '')
}
