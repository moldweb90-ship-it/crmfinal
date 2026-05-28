'use client'

import { useMemo, useState } from 'react'
import { addDays, isAfter, isBefore, isSameDay, parseISO, startOfDay } from 'date-fns'
import {
  CalendarClock,
  Check,
  Clock,
  Edit3,
  Flag,
  Loader2,
  MoreHorizontal,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLeads, usePatients, useTasks } from '@/lib/hooks'
import { db } from '@/lib/insforge'
import { dateLabel, taskStatuses } from '@/lib/crm'
import { cn } from '@/lib/utils'

type TaskActor = {
  key: string
  name: string
  phone?: string
  source?: string
  kind: string
}
type TaskGroup = { actor: TaskActor; tasks: any[] }

const priorityConfig: Record<string, { label: string; tone: string; rank: number }> = {
  low: { label: 'Низкий', tone: 'bg-slate-100 text-slate-600 border-slate-200', rank: 1 },
  normal: { label: 'Обычный', tone: 'bg-sky-50 text-sky-700 border-sky-200', rank: 2 },
  high: { label: 'Высокий', tone: 'bg-amber-50 text-amber-700 border-amber-200', rank: 3 },
  urgent: { label: 'Срочно', tone: 'bg-rose-50 text-rose-700 border-rose-200', rank: 4 },
}

const statusConfig: Record<string, { label: string; tone: string }> = {
  open: { label: 'Открыта', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  in_progress: { label: 'В работе', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  done: { label: 'Готово', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Отмена', tone: 'bg-slate-100 text-slate-600 border-slate-200' },
}

const emptyTask = {
  id: '',
  title: '',
  description: '',
  due_at: '',
  priority: 'normal',
  status: 'open',
  patient_id: 'none',
  lead_id: 'none',
}

const dateFilters = [
  { value: 'actionable', label: 'К действию' },
  { value: 'all', label: 'Все даты' },
  { value: 'today', label: 'Сегодня' },
  { value: 'tomorrow', label: 'Завтра' },
  { value: 'week', label: '7 дней' },
  { value: 'overdue', label: 'Просрочено' },
  { value: 'no_date', label: 'Без даты' },
]

const taskDueValue = (task: any) => task.due_at || task.due_date || null
const taskDate = (task: any) => {
  const value = taskDueValue(task)
  return value ? parseISO(value) : null
}
const isClosed = (task: any) => ['done', 'cancelled'].includes(task.status)

export function TasksBoard() {
  const { tasks, isLoading, mutate } = useTasks()
  const { patients } = usePatients()
  const { leads } = useLeads()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('actionable')
  const [sortBy, setSortBy] = useState('due_asc')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyTask)

  const now = new Date()
  const today = startOfDay(now)
  const tomorrow = addDays(today, 1)
  const afterTomorrow = addDays(today, 2)
  const weekEnd = addDays(today, 7)

  const patientById = (id?: string | null) => patients.find((patient: any) => patient.id === id)
  const leadById = (id?: string | null) => leads.find((lead: any) => lead.id === id)

  const actorFor = (task: any) => {
    const patient = patientById(task.patient_id)
    const lead = leadById(task.lead_id)

    if (patient) {
      return {
        key: `patient:${patient.id}`,
        name: patient.full_name || 'Пациент',
        phone: patient.phone,
        source: patient.source,
        kind: 'Пациент',
      }
    }

    if (lead) {
      return {
        key: `lead:${lead.id}`,
        name: lead.name || 'Заявка',
        phone: lead.phone,
        source: lead.source,
        kind: 'Заявка',
      }
    }

    return {
      key: 'general',
      name: 'Без привязки',
      phone: '',
      source: '',
      kind: 'Задача',
    }
  }

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return tasks
      .filter((task: any) => {
        const patient = patientById(task.patient_id)
        const lead = leadById(task.lead_id)
        const due = taskDate(task)
        const haystack = `${task.title || ''} ${task.description || ''} ${patient?.full_name || ''} ${patient?.phone || ''} ${lead?.name || ''} ${lead?.phone || ''}`.toLowerCase()

        if (normalizedQuery && !haystack.includes(normalizedQuery)) return false
        if (statusFilter === 'active' && isClosed(task)) return false
        if (statusFilter !== 'all' && statusFilter !== 'active' && task.status !== statusFilter) return false
        if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false
        if (dateFilter === 'actionable' && !(due && !isClosed(task) && isBefore(due, afterTomorrow))) return false
        if (dateFilter === 'today' && !(due && isSameDay(due, today))) return false
        if (dateFilter === 'tomorrow' && !(due && isSameDay(due, tomorrow))) return false
        if (dateFilter === 'week' && !(due && !isBefore(due, today) && !isAfter(due, weekEnd))) return false
        if (dateFilter === 'overdue' && !(due && !isClosed(task) && isBefore(due, today))) return false
        if (dateFilter === 'no_date' && due) return false

        return true
      })
      .sort((a: any, b: any) => {
        if (sortBy === 'created_desc') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        if (sortBy === 'priority_desc') return (priorityConfig[b.priority]?.rank || 0) - (priorityConfig[a.priority]?.rank || 0)

        const aDue = taskDueValue(a) ? new Date(taskDueValue(a)).getTime() : Number.MAX_SAFE_INTEGER
        const bDue = taskDueValue(b) ? new Date(taskDueValue(b)).getTime() : Number.MAX_SAFE_INTEGER
        return sortBy === 'due_desc' ? bDue - aDue : aDue - bDue
      })
  }, [tasks, query, statusFilter, priorityFilter, dateFilter, sortBy, patients, leads])

  const agendaSections = useMemo(() => {
    const sectionDefs = [
      {
        key: 'overdue',
        title: 'Просрочено',
        subtitle: 'Сначала закрываем хвосты, чтобы менеджера не разносило по дню.',
        tone: 'border-rose-200 bg-rose-50/55',
        match: (task: any) => {
          const due = taskDate(task)
          return due && !isClosed(task) && isBefore(due, today)
        },
      },
      {
        key: 'today',
        title: 'Сегодня',
        subtitle: 'То, что нужно обработать до конца дня.',
        tone: 'border-teal-200 bg-teal-50/55',
        match: (task: any) => {
          const due = taskDate(task)
          return due && isSameDay(due, today)
        },
      },
      {
        key: 'tomorrow',
        title: 'Завтра',
        subtitle: 'Можно подготовить звонки и записи заранее.',
        tone: 'border-sky-200 bg-sky-50/55',
        match: (task: any) => {
          const due = taskDate(task)
          return due && isSameDay(due, tomorrow)
        },
      },
      {
        key: 'week',
        title: 'Ближайшие 7 дней',
        subtitle: 'Автоматические касания, отзывы и контроль повторного визита.',
        tone: 'border-violet-200 bg-violet-50/45',
        match: (task: any) => {
          const due = taskDate(task)
          return due && isAfter(due, tomorrow) && !isAfter(due, weekEnd)
        },
      },
      {
        key: 'later',
        title: 'Позже',
        subtitle: 'Дальние проверки, осмотры и повторные визиты.',
        tone: 'border-slate-200 bg-white',
        match: (task: any) => {
          const due = taskDate(task)
          return due && isAfter(due, weekEnd)
        },
      },
      {
        key: 'no_date',
        title: 'Без даты',
        subtitle: 'Лучше назначить срок, чтобы задача не висела в воздухе.',
        tone: 'border-amber-200 bg-amber-50/40',
        match: (task: any) => !taskDueValue(task),
      },
    ]

    return sectionDefs
      .map((section) => {
        const sectionTasks = filtered.filter(section.match)
        const groups = Array.from(
          sectionTasks.reduce((map: Map<string, TaskGroup>, task: any) => {
            const actor = actorFor(task)
            const current = map.get(actor.key) || { actor, tasks: [] as any[] }
            current.tasks.push(task)
            map.set(actor.key, current)
            return map
          }, new Map<string, TaskGroup>()).values()
        ) as TaskGroup[]

        return { ...section, tasks: sectionTasks, groups }
      })
      .filter((section) => section.tasks.length > 0)
  }, [filtered, patients, leads])

  const openCreate = () => {
    setForm(emptyTask)
    setOpen(true)
  }

  const openEdit = (task: any) => {
    setForm({
      id: task.id,
      title: task.title || '',
      description: task.description || '',
      due_at: taskDueValue(task) ? taskDueValue(task).slice(0, 16) : '',
      priority: task.priority || 'normal',
      status: task.status || 'open',
      patient_id: task.patient_id || 'none',
      lead_id: task.lead_id || 'none',
    })
    setOpen(true)
  }

  const saveTask = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description || null,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        priority: form.priority,
        patient_id: form.patient_id === 'none' ? null : form.patient_id,
        lead_id: form.lead_id === 'none' ? null : form.lead_id,
        status: form.status,
      }

      if (form.id) {
        await db.from('tasks').update(payload).eq('id', form.id)
      } else {
        await db.from('tasks').insert([payload])
      }

      setForm(emptyTask)
      setOpen(false)
      mutate()
    } finally {
      setSaving(false)
    }
  }

  const setStatus = async (id: string, status: string) => {
    await db.from('tasks').update({ status }).eq('id', id)
    mutate()
  }

  const deleteTask = async (task: any) => {
    const ok = window.confirm(`Удалить задачу "${task.title}"?`)
    if (!ok) return

    await db.from('tasks').delete().eq('id', task.id)
    mutate()
  }

  const resetFilters = () => {
    setQuery('')
    setStatusFilter('active')
    setPriorityFilter('all')
    setDateFilter('actionable')
    setSortBy('due_asc')
  }

  const actionableCount = tasks.filter((task: any) => {
    const due = taskDate(task)
    return due && !isClosed(task) && isBefore(due, afterTomorrow)
  }).length
  const todayCount = tasks.filter((task: any) => {
    const due = taskDate(task)
    return due && isSameDay(due, today) && !isClosed(task)
  }).length
  const tomorrowCount = tasks.filter((task: any) => {
    const due = taskDate(task)
    return due && isSameDay(due, tomorrow) && !isClosed(task)
  }).length
  const overdueCount = tasks.filter((task: any) => {
    const due = taskDate(task)
    return due && isBefore(due, today) && !isClosed(task)
  }).length
  const plannedLaterCount = tasks.filter((task: any) => {
    const due = taskDate(task)
    return due && !isClosed(task) && !isBefore(due, afterTomorrow)
  }).length

  return (
    <div className="space-y-6 animate-soft-in">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Задачи менеджера</h1>
          <p className="mt-1 text-slate-500">
            Уведомления показывают только то, что нужно сделать сейчас: просрочено, сегодня и завтра. Дальние задачи живут в плане.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={openCreate} className="h-11 rounded-2xl bg-gradient-to-r from-teal-500 to-sky-500 text-white hover:from-teal-600 hover:to-sky-600">
            <Plus className="mr-2 h-4 w-4" />
            Задача
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="К действию" value={actionableCount} />
        <Metric label="Сегодня" value={todayCount} tone="text-teal-700 bg-teal-50" />
        <Metric label="Завтра" value={tomorrowCount} tone="text-sky-700 bg-sky-50" />
        <Metric label="Просрочено" value={overdueCount} tone="text-rose-700 bg-rose-50" />
      </div>

      {plannedLaterCount > 0 && dateFilter !== 'all' && (
        <div className="rounded-3xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm">
          В плане есть еще {plannedLaterCount} дальние задачи. Они не попадают в уведомления и появятся здесь ближе к сроку.
          <Button variant="link" className="h-auto px-2 text-teal-700" onClick={() => setDateFilter('all')}>
            Показать все даты
          </Button>
        </div>
      )}

      <Card className="crm-panel border-0">
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1fr_160px_160px_160px_180px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по задаче, пациенту, телефону, заявке..."
              className="h-11 rounded-2xl bg-white pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 rounded-2xl bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Активные</SelectItem>
              <SelectItem value="all">Все статусы</SelectItem>
              {Object.entries(statusConfig).map(([key, status]) => <SelectItem key={key} value={key}>{status.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-11 rounded-2xl bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все приоритеты</SelectItem>
              {Object.entries(priorityConfig).map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-11 rounded-2xl bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {dateFilters.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-11 rounded-2xl bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="due_asc">Сначала ближайшие</SelectItem>
              <SelectItem value="due_desc">Сначала дальние</SelectItem>
              <SelectItem value="priority_desc">По приоритету</SelectItem>
              <SelectItem value="created_desc">Новые сверху</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={resetFilters} className="h-11 rounded-2xl bg-white">
            <RotateCcw className="mr-2 h-4 w-4" />
            Сброс
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-4">
          {agendaSections.length === 0 ? (
            <Card className="crm-panel border-0">
              <CardContent className="p-10 text-center text-sm text-slate-500">
                По этим фильтрам задач нет. Можно спокойно выдохнуть или сбросить фильтры.
              </CardContent>
            </Card>
          ) : agendaSections.map((section) => (
            <section key={section.key} className={cn('rounded-3xl border p-4 shadow-sm', section.tone)}>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-slate-950">{section.title}</h2>
                    <Badge variant="outline" className="bg-white">{section.tasks.length}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{section.subtitle}</p>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                {section.groups.map((group) => (
                  <Card key={group.actor.key} className="border-white/80 bg-white/90 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex flex-col gap-3 text-base sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-lg">{group.actor.name}</span>
                            <Badge variant="outline" className="bg-white">{group.actor.kind}</Badge>
                            <Badge variant="outline" className="bg-white">{group.tasks.length} задач</Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-normal text-slate-500">
                            {group.actor.phone ? (
                              <a
                                href={`tel:${group.actor.phone}`}
                                className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 font-medium text-teal-800 transition hover:bg-teal-100"
                              >
                                <Phone className="h-3.5 w-3.5" />
                                {group.actor.phone}
                              </a>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border bg-slate-50 px-3 py-1 text-slate-500">
                                <Phone className="h-3.5 w-3.5" />
                                нет телефона
                              </span>
                            )}
                            {group.actor.source && <span className="rounded-full border bg-white px-3 py-1">Источник: {group.actor.source}</span>}
                          </div>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {group.tasks.map((task: any) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          patient={patientById(task.patient_id)}
                          lead={leadById(task.lead_id)}
                          onEdit={() => openEdit(task)}
                          onDelete={() => deleteTask(task)}
                          onStatus={setStatus}
                          compact
                          hideActor
                        />
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Редактировать задачу' : 'Новая задача'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Название</Label>
              <Input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Позвонить пациенту после консультации"
              />
            </div>
            <div className="grid gap-2">
              <Label>Описание</Label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Контекст, что уточнить, что обещали"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Дедлайн</Label>
                <Input type="datetime-local" value={form.due_at} onChange={(event) => setForm({ ...form, due_at: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Приоритет</Label>
                <Select value={form.priority} onValueChange={(priority) => setForm({ ...form, priority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(priorityConfig).map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Статус</Label>
                <Select value={form.status} onValueChange={(status) => setForm({ ...form, status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(statusConfig).map(([key, status]) => <SelectItem key={key} value={key}>{status.label}</SelectItem>)}</SelectContent>
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
            {form.id && (
              <Button
                variant="outline"
                className="mr-auto border-rose-200 text-rose-600 hover:bg-rose-50"
                onClick={() => {
                  const task = tasks.find((item: any) => item.id === form.id)
                  if (task) deleteTask(task)
                  setOpen(false)
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Удалить
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={saveTask} disabled={saving} className="bg-teal-600 hover:bg-teal-700">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {form.id ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TaskCard({ task, patient, lead, onEdit, onDelete, onStatus, compact, hideActor }: any) {
  const status = statusConfig[task.status] || statusConfig.open || taskStatuses.open
  const priority = priorityConfig[task.priority] || priorityConfig.normal
  const dueValue = taskDueValue(task)
  const due = taskDate(task)
  const overdue = task.status !== 'done' && task.status !== 'cancelled' && due && isBefore(due, startOfDay(new Date()))
  const phone = patient?.phone || lead?.phone

  return (
    <div className={cn(
      'rounded-2xl border bg-white p-4 shadow-sm transition hover:border-teal-200 hover:shadow-md',
      overdue && 'border-rose-200 bg-rose-50/60',
      compact && 'rounded-2xl p-3 shadow-none hover:shadow-sm'
    )}>
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
          <h3 className="font-semibold leading-snug text-slate-950">{task.title}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {task.is_automated && <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700">Авто</Badge>}
            {task.source_type && (
              <Badge variant="outline" className="bg-slate-50">
                {task.source_type === 'appointment' ? 'После визита' : task.source_type === 'treatment_plan' ? 'После плана' : 'Сопровождение'}
              </Badge>
            )}
          </div>
          {task.description && <p className="mt-2 line-clamp-2 text-sm text-slate-500">{task.description}</p>}
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className={status.tone}>{status.label}</Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}><Edit3 className="h-4 w-4" />Редактировать</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatus(task.id, 'open')}><Clock className="h-4 w-4" />Открытая</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatus(task.id, 'in_progress')}><CalendarClock className="h-4 w-4" />В работу</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatus(task.id, 'done')}><Check className="h-4 w-4" />Готово</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatus(task.id, 'cancelled')}>Отменить</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-rose-600 focus:text-rose-600"><Trash2 className="h-4 w-4" />Удалить</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Badge variant="outline" className={priority.tone}>
          <Flag className="mr-1 h-3 w-3" />
          {priority.label}
        </Badge>
        {dueValue && (
          <span className={cn('inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1', overdue && 'border-rose-200 text-rose-700')}>
            <CalendarClock className="h-3.5 w-3.5" />
            {dateLabel(dueValue)}
          </span>
        )}
        {!hideActor && patient && (
          <span className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1">
            <UserRound className="h-3.5 w-3.5" />
            {patient.full_name}
          </span>
        )}
        {!hideActor && lead && (
          <span className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1">
            <UserRound className="h-3.5 w-3.5" />
            Заявка: {lead.name}
          </span>
        )}
        {!hideActor && phone && (
          <a href={`tel:${phone}`} className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 font-medium text-teal-800">
            <Phone className="h-3.5 w-3.5" />
            {phone}
          </a>
        )}
      </div>

      {task.status !== 'done' && task.status !== 'cancelled' && (
        <div className="mt-4 flex flex-wrap gap-2">
          {task.status !== 'in_progress' && <Button size="sm" variant="outline" onClick={() => onStatus(task.id, 'in_progress')}>В работу</Button>}
          <Button size="sm" onClick={() => onStatus(task.id, 'done')} className="bg-emerald-600 hover:bg-emerald-700">
            <Check className="mr-1 h-3 w-3" />
            Готово
          </Button>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, tone = 'text-slate-700 bg-white' }: { label: string; value: number; tone?: string }) {
  return (
    <Card className="crm-panel border-0">
      <CardContent className="flex items-center justify-between p-4">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className={`rounded-xl px-3 py-1 text-2xl font-semibold ${tone}`}>{value}</span>
      </CardContent>
    </Card>
  )
}
