'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ClipboardPlus,
  Clock3,
  CreditCard,
  Edit3,
  Eye,
  FileText,
  Filter,
  Loader2,
  MoreHorizontal,
  PhoneCall,
  Plus,
  RotateCcw,
  Search,
  Send,
  Stethoscope,
  Trash2,
  TrendingUp,
  UserRound,
  WalletCards,
  XCircle,
} from 'lucide-react'
import { addDays, format, isAfter, isBefore, parseISO, startOfDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { db } from '@/lib/insforge'
import { useAppointments, useDoctors, usePatients, usePayments, useTasks, useTreatmentPlans } from '@/lib/hooks'
import { dateLabel, money, planStatuses } from '@/lib/crm'
import { ensurePatientAftercareTasks } from '@/lib/manager-automation'
import { cn } from '@/lib/utils'

const activeStatuses = ['draft', 'proposed', 'thinking', 'accepted', 'in_progress']
const closedStatuses = ['completed', 'declined']

const statusFlow = [
  { value: 'draft', label: 'Черновик' },
  { value: 'proposed', label: 'Предложен' },
  { value: 'thinking', label: 'Думает' },
  { value: 'accepted', label: 'Согласован' },
  { value: 'in_progress', label: 'В лечении' },
  { value: 'completed', label: 'Завершен' },
  { value: 'declined', label: 'Отказ' },
]

const segmentOptions = [
  { value: 'active', label: 'Активные' },
  { value: 'thinking', label: 'Думают' },
  { value: 'accepted_no_payment', label: 'Без оплаты' },
  { value: 'accepted_no_visit', label: 'Без записи' },
  { value: 'overdue', label: 'Просрочены' },
  { value: 'completed', label: 'Закрытые' },
  { value: 'all', label: 'Все' },
]

const emptyForm = {
  patient_id: '',
  doctor_id: 'none',
  title: '',
  category: 'Комплексное лечение',
  amount: '',
  status: 'proposed',
  next_contact_at: '',
  decline_reason: '',
  comment: '',
  stages_text: '',
}

export function TreatmentPlansList() {
  const { plans, isLoading, mutate } = useTreatmentPlans()
  const { patients, mutate: mutatePatients } = usePatients()
  const { doctors } = useDoctors()
  const { payments, mutate: mutatePayments } = usePayments()
  const { appointments } = useAppointments()
  const { tasks, mutate: mutateTasks } = useTasks()
  const [query, setQuery] = useState('')
  const [segment, setSegment] = useState('active')
  const [statusFilter, setStatusFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<any>(null)
  const [editingPlan, setEditingPlan] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const today = startOfDay(new Date())
  const patientById = (id?: string) => patients.find((patient: any) => patient.id === id)
  const doctorById = (id?: string) => doctors.find((doctor: any) => doctor.id === id)

  const enrichedPlans = useMemo(() => {
    return plans.map((plan: any) => {
      const patient = patientById(plan.patient_id)
      const doctor = doctorById(plan.doctor_id)
      const planPayments = payments.filter((payment: any) => payment.treatment_plan_id === plan.id)
      const paid = planPayments.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0)
      const amount = Number(plan.amount || 0)
      const balance = Math.max(0, amount - paid)
      const patientAppointments = appointments.filter((appointment: any) => appointment.patient_id === plan.patient_id)
      const hasFutureVisit = patientAppointments.some((appointment: any) => {
        if (!appointment.start_time || ['cancelled', 'no_show'].includes(appointment.status)) return false
        return isAfter(parseISO(appointment.start_time), new Date())
      })
      const activePlanTasks = tasks.filter((task: any) =>
        task.source_type === 'treatment_plan' &&
        task.source_id === plan.id &&
        !['done', 'cancelled'].includes(task.status),
      )
      const nextContact = plan.next_contact_at ? parseISO(plan.next_contact_at) : null
      const isOverdue = Boolean(nextContact && isBefore(nextContact, today) && !closedStatuses.includes(plan.status))

      return {
        ...plan,
        patient,
        doctor,
        paid,
        balance,
        paymentProgress: amount > 0 ? Math.min(100, Math.round((paid / amount) * 100)) : 0,
        hasFutureVisit,
        activeTasksCount: activePlanTasks.length,
        isOverdue,
      }
    })
  }, [plans, patients, doctors, payments, appointments, tasks, today])

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return enrichedPlans
      .filter((plan: any) => {
        const haystack = `${plan.title || ''} ${plan.category || ''} ${plan.patient?.full_name || ''} ${plan.patient?.phone || ''} ${plan.comment || ''}`.toLowerCase()
        if (normalizedQuery && !haystack.includes(normalizedQuery)) return false
        if (statusFilter !== 'all' && plan.status !== statusFilter) return false
        if (segment === 'active' && !activeStatuses.includes(plan.status)) return false
        if (segment === 'thinking' && plan.status !== 'thinking') return false
        if (segment === 'accepted_no_payment' && !(plan.status === 'accepted' && plan.paid <= 0)) return false
        if (segment === 'accepted_no_visit' && !(plan.status === 'accepted' && !plan.hasFutureVisit)) return false
        if (segment === 'overdue' && !plan.isOverdue) return false
        if (segment === 'completed' && !closedStatuses.includes(plan.status)) return false
        return true
      })
      .sort((a: any, b: any) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
        return dateValue(a.next_contact_at || a.created_at) - dateValue(b.next_contact_at || b.created_at)
      })
  }, [enrichedPlans, query, segment, statusFilter])

  const totals = {
    activeAmount: enrichedPlans.filter((plan: any) => activeStatuses.includes(plan.status)).reduce((sum: number, plan: any) => sum + Number(plan.amount || 0), 0),
    paid: enrichedPlans.reduce((sum: number, plan: any) => sum + Number(plan.paid || 0), 0),
    balance: enrichedPlans.filter((plan: any) => activeStatuses.includes(plan.status)).reduce((sum: number, plan: any) => sum + Number(plan.balance || 0), 0),
    thinking: enrichedPlans.filter((plan: any) => plan.status === 'thinking').length,
    overdue: enrichedPlans.filter((plan: any) => plan.isOverdue).length,
  }

  const resetFilters = () => {
    setQuery('')
    setSegment('active')
    setStatusFilter('all')
  }

  const openCreate = () => {
    setEditingPlan(null)
    setForm(emptyForm)
    setOpen(true)
  }

  const openEdit = (plan: any) => {
    setEditingPlan(plan)
    setForm({
      patient_id: plan.patient_id || '',
      doctor_id: plan.doctor_id || 'none',
      title: plan.title || '',
      category: plan.category || 'Комплексное лечение',
      amount: String(plan.amount || ''),
      status: plan.status || 'proposed',
      next_contact_at: toDatetimeLocal(plan.next_contact_at),
      decline_reason: plan.decline_reason || '',
      comment: plan.comment || '',
      stages_text: Array.isArray(plan.stages) ? plan.stages.map((stage: any) => stage.title || stage).join('\n') : (plan.stages_text || ''),
    })
    setOpen(true)
  }

  const savePlan = async () => {
    if (!form.patient_id || !form.title) return
    setSaving(true)
    try {
      const payload = {
        patient_id: form.patient_id,
        doctor_id: form.doctor_id === 'none' ? null : form.doctor_id,
        title: form.title,
        category: form.category || null,
        amount: Number(form.amount || 0),
        status: form.status,
        next_contact_at: form.next_contact_at ? new Date(form.next_contact_at).toISOString() : null,
        decline_reason: form.status === 'declined' ? form.decline_reason || null : null,
        comment: form.comment || null,
        stages: form.stages_text.split('\n').map((item) => item.trim()).filter(Boolean).map((title, index) => ({ id: `stage-${index + 1}`, title, done: false })),
        updated_at: new Date().toISOString(),
      }

      let planId = editingPlan?.id
      if (editingPlan) {
        await db.from('treatment_plans').update(payload).eq('id', editingPlan.id)
      } else {
        const result = await db.from('treatment_plans').insert([{ ...payload, created_at: new Date().toISOString() }]).select()
        planId = result.data?.[0]?.id
      }

      await applyPlanAutomation(planId || editingPlan?.id || form.title, payload, patientById(form.patient_id))
      setOpen(false)
      setEditingPlan(null)
      setForm(emptyForm)
      mutate()
      mutatePatients()
      mutateTasks()
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (plan: any, status: string, patch: Record<string, any> = {}) => {
    const payload = { status, updated_at: new Date().toISOString(), ...patch }
    await db.from('treatment_plans').update(payload).eq('id', plan.id)
    await applyPlanAutomation(plan.id, { ...plan, ...payload }, plan.patient)
    mutate()
    mutatePatients()
    mutateTasks()
  }

  const addPayment = async (plan: any) => {
    const input = window.prompt(`Сумма оплаты по плану "${plan.title}"`, String(plan.balance || plan.amount || ''))
    if (!input) return
    const amount = Number(input.replace(',', '.'))
    if (!amount || amount <= 0) return
    await db.from('payments').insert([{
      patient_id: plan.patient_id,
      treatment_plan_id: plan.id,
      amount,
      method: 'cash',
      paid_at: new Date().toISOString(),
      comment: `Оплата по плану: ${plan.title}`,
    }])
    if (plan.patient) {
      await db.from('patients').update({
        total_spent: Number(plan.patient.total_spent || 0) + amount,
        debt: Math.max(0, Number(plan.patient.debt || 0) - amount),
      }).eq('id', plan.patient_id)
    }
    mutatePayments()
    mutatePatients()
  }

  const deletePlan = async (plan: any) => {
    const ok = window.confirm(`Удалить план лечения "${plan.title}"?`)
    if (!ok) return
    await db.from('treatment_plans').delete().eq('id', plan.id)
    setDetailOpen(false)
    setSelectedPlan(null)
    mutate()
  }

  const applyPlanAutomation = async (planId: string, plan: any, patient: any) => {
    if (!patient) return
    const patientName = patient.full_name || 'пациент'

    await db.from('contact_history').insert([{
      patient_id: patient.id,
      type: 'note',
      direction: 'internal',
      summary: `План лечения "${plan.title}" переведен в статус: ${statusFlow.find((item) => item.value === plan.status)?.label || plan.status}${plan.decline_reason ? `. Причина отказа: ${plan.decline_reason}` : ''}`,
      created_at: new Date().toISOString(),
    }])

    if (plan.status === 'thinking') {
      const due = plan.next_contact_at ? new Date(plan.next_contact_at) : setWorkTime(addDays(new Date(), 1), 10)
      await db.from('patients').update({ status: 'thinking', next_follow_up_at: due.toISOString() }).eq('id', patient.id)
      await createPlanTask(planId, {
        key: 'thinking-follow-up',
        title: `Дожать план лечения: ${patientName}`,
        description: `Пациент думает по плану "${plan.title}" на сумму ${money(plan.amount)}. Позвонить, снять возражения, предложить удобную запись/оплату.`,
        due_at: due.toISOString(),
        priority: 'high',
        patient_id: patient.id,
      })
    }

    if (plan.status === 'accepted') {
      await db.from('patients').update({ status: 'active' }).eq('id', patient.id)
      await createPlanTask(planId, {
        key: 'accepted-payment',
        title: `Получить оплату/предоплату: ${patientName}`,
        description: `План "${plan.title}" согласован. Уточнить способ оплаты, предоплату или кредит.`,
        due_at: setWorkTime(addDays(new Date(), 1), 11).toISOString(),
        priority: 'high',
        patient_id: patient.id,
      })
      await createPlanTask(planId, {
        key: 'accepted-booking',
        title: `Записать пациента по плану: ${patientName}`,
        description: `План согласован. Подобрать врача, филиал и ближайший удобный слот.`,
        due_at: setWorkTime(addDays(new Date(), 1), 12).toISOString(),
        priority: 'high',
        patient_id: patient.id,
      })
    }

    if (plan.status === 'declined') {
      await db.from('patients').update({
        status: 'needs_follow_up',
        next_follow_up_at: setWorkTime(addDays(new Date(), 14), 10).toISOString(),
        manager_notes: `Отказ по плану "${plan.title}". ${plan.decline_reason || ''}`.trim(),
      }).eq('id', patient.id)
      await createPlanTask(planId, {
        key: 'declined-return-14',
        title: `Вернуть пациента после отказа: ${patientName}`,
        description: `Через 14 дней вернуться к плану "${plan.title}". Причина отказа: ${plan.decline_reason || 'не указана'}. Предложить альтернативу, рассрочку, кейс или повторную консультацию.`,
        due_at: setWorkTime(addDays(new Date(), 14), 10).toISOString(),
        priority: 'normal',
        patient_id: patient.id,
      })
    }

    if (plan.status === 'completed') {
      await ensurePatientAftercareTasks({
        patientId: patient.id,
        patientName,
        sourceType: 'treatment_plan',
        sourceId: planId,
        checkupMonths: Number(patient.aftercare_checkup_months || 6),
      })
    }
  }

  const createPlanTask = async (planId: string, task: any) => {
    const automationKey = `plan:${planId}:${task.key}`
    const { data } = await db.from('tasks').select('*').eq('automation_key', automationKey)
    if (data?.length) return
    await db.from('tasks').insert([{
      title: task.title,
      description: task.description,
      due_at: task.due_at,
      priority: task.priority || 'normal',
      status: 'open',
      patient_id: task.patient_id,
      source_type: 'treatment_plan',
      source_id: planId,
      automation_key: automationKey,
      is_automated: true,
    }])
  }

  return (
    <div className="space-y-6 animate-soft-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Планы лечения</h1>
          <p className="mt-1 max-w-3xl text-slate-500">
            Деньги в работе: предложения, согласования, оплаты, записи и автоматические задачи менеджеру.
          </p>
        </div>
        <Button onClick={openCreate} className="h-11 rounded-2xl bg-gradient-to-r from-teal-500 to-sky-500 text-white shadow-lg shadow-cyan-200/50 hover:from-teal-600 hover:to-sky-600">
          <Plus className="mr-2 h-4 w-4" />
          Новый план
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Активные планы" value={money(totals.activeAmount)} icon={TrendingUp} tone="bg-sky-50 text-sky-700" />
        <MetricCard label="Оплачено" value={money(totals.paid)} icon={CreditCard} tone="bg-emerald-50 text-emerald-700" />
        <MetricCard label="Остаток" value={money(totals.balance)} icon={WalletCards} tone="bg-amber-50 text-amber-700" />
        <MetricCard label="Думают" value={totals.thinking} icon={Clock3} tone="bg-violet-50 text-violet-700" />
        <MetricCard label="Просрочено" value={totals.overdue} icon={AlertCircle} tone="bg-rose-50 text-rose-700" />
      </div>

      <Card className="crm-panel border-0">
        <CardContent className="space-y-4 p-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {segmentOptions.map((item) => (
              <Button
                key={item.value}
                variant={segment === item.value ? 'default' : 'outline'}
                onClick={() => setSegment(item.value)}
                className={cn('h-10 shrink-0 rounded-2xl', segment === item.value ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-white')}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_190px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск: план, пациент, телефон, комментарий..." className="h-11 rounded-2xl bg-white pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-11 rounded-2xl bg-white"><Filter className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                {statusFlow.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}
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
          {isLoading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <ClipboardPlus className="mx-auto mb-4 h-12 w-12 text-slate-300" />
              <h3 className="text-lg font-semibold text-slate-700">Планов по фильтрам нет</h3>
              <p className="text-sm text-slate-400">Создайте план или сбросьте фильтры.</p>
            </div>
          ) : (
            <div className="grid gap-4 p-4 xl:grid-cols-2">
              {filtered.map((plan: any) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onOpen={() => { setSelectedPlan(plan); setDetailOpen(true) }}
                  onEdit={() => openEdit(plan)}
                  onDelete={() => deletePlan(plan)}
                  onPayment={() => addPayment(plan)}
                  onStatus={(status: string, patch?: Record<string, any>) => updateStatus(plan, status, patch)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PlanFormDialog
        open={open}
        onOpenChange={setOpen}
        form={form}
        setForm={setForm}
        patients={patients}
        doctors={doctors}
        saving={saving}
        editing={Boolean(editingPlan)}
        onSave={savePlan}
      />

      <PlanDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        plan={selectedPlan}
        onEdit={() => selectedPlan && openEdit(selectedPlan)}
        onDelete={() => selectedPlan && deletePlan(selectedPlan)}
        onPayment={() => selectedPlan && addPayment(selectedPlan)}
        onStatus={(status: string, patch?: Record<string, any>) => selectedPlan && updateStatus(selectedPlan, status, patch)}
      />
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: any; tone: string }) {
  return (
    <Card className="crm-panel border-0">
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div>
        </div>
        <div className={cn('rounded-2xl p-3', tone)}><Icon className="h-5 w-5" /></div>
      </CardContent>
    </Card>
  )
}

function PlanCard({ plan, onOpen, onEdit, onDelete, onPayment, onStatus }: any) {
  const status = planStatuses[plan.status] || planStatuses.proposed

  return (
    <div className={cn('rounded-3xl border bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow-md', plan.isOverdue && 'border-rose-200 bg-rose-50/30')}>
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-semibold text-slate-950">{plan.title}</h3>
            <Badge variant="outline" className={status.tone}>{status.label}</Badge>
            {plan.isOverdue && <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">просрочен</Badge>}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {plan.patient?.full_name || 'Пациент не указан'} · {dateLabel(plan.created_at, 'd MMM yyyy')}
          </p>
        </button>
        <PlanMenu plan={plan} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} onPayment={onPayment} onStatus={onStatus} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MiniMoney label="Сумма" value={plan.amount} />
        <MiniMoney label="Оплачено" value={plan.paid} tone="text-emerald-700" />
        <MiniMoney label="Остаток" value={plan.balance} tone={plan.balance > 0 ? 'text-amber-700' : 'text-emerald-700'} />
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>Оплата</span>
          <span>{plan.paymentProgress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-sky-500" style={{ width: `${plan.paymentProgress}%` }} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-500">
        {plan.doctor && <Badge variant="outline" className="bg-white"><Stethoscope className="mr-1 h-3 w-3" />{plan.doctor.full_name}</Badge>}
        {plan.next_contact_at && <Badge variant="outline" className="bg-white"><CalendarClock className="mr-1 h-3 w-3" />{formatPlanDate(plan.next_contact_at)}</Badge>}
        {plan.activeTasksCount > 0 && <Badge variant="outline" className="bg-white">{plan.activeTasksCount} задач</Badge>}
      </div>

      {plan.comment && <p className="mt-3 line-clamp-2 text-sm text-slate-600">{plan.comment}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {plan.status === 'proposed' && <Button size="sm" variant="outline" onClick={() => onStatus('thinking')}>Думает</Button>}
        {['proposed', 'thinking'].includes(plan.status) && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onStatus('accepted')}>Согласован</Button>}
        {plan.status === 'accepted' && <Button size="sm" variant="outline" onClick={() => onStatus('in_progress')}>В лечении</Button>}
        {plan.status === 'in_progress' && <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => onStatus('completed')}>Завершить</Button>}
        {!closedStatuses.includes(plan.status) && <Button size="sm" variant="outline" onClick={onPayment}><CreditCard className="mr-1 h-3 w-3" />Оплата</Button>}
      </div>
    </div>
  )
}

function PlanMenu({ plan, onOpen, onEdit, onDelete, onPayment, onStatus }: any) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-xl"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onClick={onOpen}><Eye className="h-4 w-4" />Открыть карточку</DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}><Edit3 className="h-4 w-4" />Редактировать</DropdownMenuItem>
        <DropdownMenuItem onClick={onPayment}><CreditCard className="h-4 w-4" />Добавить оплату</DropdownMenuItem>
        {plan.patient?.phone && (
          <DropdownMenuItem asChild>
            <a href={`tel:${plan.patient.phone}`}><PhoneCall className="h-4 w-4" />Позвонить пациенту</a>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onStatus('thinking')}><Clock3 className="h-4 w-4" />Пациент думает</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStatus('accepted')}><CheckCircle2 className="h-4 w-4" />Согласован</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStatus('declined', { decline_reason: plan.decline_reason || 'Причина не указана' })}><XCircle className="h-4 w-4" />Отказ</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-rose-600 focus:text-rose-600"><Trash2 className="h-4 w-4" />Удалить</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PlanFormDialog({ open, onOpenChange, form, setForm, patients, doctors, saving, editing, onSave }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader><DialogTitle>{editing ? 'Редактировать план лечения' : 'Новый план лечения'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Пациент *</Label>
              <Select value={form.patient_id} onValueChange={(patient_id) => setForm({ ...form, patient_id })}>
                <SelectTrigger><SelectValue placeholder="Выберите пациента" /></SelectTrigger>
                <SelectContent>{patients.map((patient: any) => <SelectItem key={patient.id} value={patient.id}>{patient.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Врач</Label>
              <Select value={form.doctor_id} onValueChange={(doctor_id) => setForm({ ...form, doctor_id })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не назначен</SelectItem>
                  {doctors.map((doctor: any) => <SelectItem key={doctor.id} value={doctor.id}>{doctor.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Название плана *</Label>
            <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Имплантация + коронка, ортодонтия, комплексное лечение..." />
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="grid gap-2 md:col-span-2">
              <Label>Категория</Label>
              <Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Сумма</Label>
              <Input type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Статус</Label>
              <Select value={form.status} onValueChange={(status) => setForm({ ...form, status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{statusFlow.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Следующий контакт</Label>
              <Input type="datetime-local" value={form.next_contact_at} onChange={(event) => setForm({ ...form, next_contact_at: event.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Причина отказа</Label>
              <Input value={form.decline_reason} onChange={(event) => setForm({ ...form, decline_reason: event.target.value })} placeholder="Если пациент отказался" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Этапы лечения</Label>
            <Textarea value={form.stages_text} onChange={(event) => setForm({ ...form, stages_text: event.target.value })} placeholder={'Каждый этап с новой строки:\nКонсультация и диагностика\nИмплантация\nСнятие слепков\nФиксация коронки'} />
          </div>
          <div className="grid gap-2">
            <Label>Комментарий менеджера</Label>
            <Textarea value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} placeholder="Возражения, условия оплаты, что обещали пациенту..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={onSave} disabled={saving} className="bg-teal-600 hover:bg-teal-700">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardPlus className="mr-2 h-4 w-4" />}
            {editing ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PlanDetailDialog({ open, onOpenChange, plan, onEdit, onDelete, onPayment, onStatus }: any) {
  if (!plan) return null
  const status = planStatuses[plan.status] || planStatuses.proposed
  const stages = Array.isArray(plan.stages) ? plan.stages : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center justify-between gap-3">
            <span>{plan.title}</span>
            <Badge variant="outline" className={status.tone}>{status.label}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 rounded-2xl border bg-slate-50/80 p-4 md:grid-cols-3">
            <Info icon={UserRound} label="Пациент" value={plan.patient?.full_name || 'Не указан'} />
            <Info icon={Stethoscope} label="Врач" value={plan.doctor?.full_name || 'Не назначен'} />
            <Info icon={CalendarClock} label="Контакт" value={plan.next_contact_at ? formatPlanDate(plan.next_contact_at) : 'Не задан'} />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <MiniMoney label="Сумма" value={plan.amount} />
            <MiniMoney label="Оплачено" value={plan.paid} tone="text-emerald-700" />
            <MiniMoney label="Остаток" value={plan.balance} tone={plan.balance > 0 ? 'text-amber-700' : 'text-emerald-700'} />
          </div>
          {stages.length > 0 && (
            <div className="rounded-2xl border p-4">
              <div className="mb-3 text-sm font-semibold text-slate-900">Этапы лечения</div>
              <div className="space-y-2">
                {stages.map((stage: any, index: number) => (
                  <div key={stage.id || index} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-500">{index + 1}</span>
                    <span>{stage.title || stage}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {plan.comment && <TextBlock icon={FileText} title="Комментарий" text={plan.comment} />}
          {plan.decline_reason && <TextBlock icon={XCircle} title="Причина отказа" text={plan.decline_reason} />}
        </div>
        <DialogFooter className="flex-wrap border-t pt-4 sm:justify-between">
          <Button variant="outline" onClick={onDelete} className="border-rose-200 text-rose-600 hover:bg-rose-50"><Trash2 className="mr-2 h-4 w-4" />Удалить</Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onEdit}><Edit3 className="mr-2 h-4 w-4" />Редактировать</Button>
            <Button variant="outline" onClick={onPayment}><CreditCard className="mr-2 h-4 w-4" />Оплата</Button>
            {!closedStatuses.includes(plan.status) && <Button onClick={() => onStatus('completed')} className="bg-teal-600 hover:bg-teal-700"><CheckCircle2 className="mr-2 h-4 w-4" />Завершить</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MiniMoney({ label, value, tone = 'text-slate-950' }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-2xl border bg-slate-50/70 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={cn('mt-1 text-lg font-semibold', tone)}>{money(value)}</div>
    </div>
  )
}

function Info({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 text-slate-400" />
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="truncate font-semibold text-slate-800">{value}</div>
      </div>
    </div>
  )
}

function TextBlock({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Icon className="h-4 w-4" />{title}</div>
      <p className="text-sm text-slate-600">{text}</p>
    </div>
  )
}

function setWorkTime(date: Date, hour: number) {
  const copy = new Date(date)
  copy.setHours(hour, 0, 0, 0)
  return copy
}

function dateValue(value?: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER
  const date = parseISO(value)
  return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime()
}

function formatPlanDate(value: string) {
  const date = parseISO(value)
  if (Number.isNaN(date.getTime())) return 'не задано'
  return format(date, 'd MMM, HH:mm', { locale: ru })
}

function toDatetimeLocal(value?: string | null) {
  if (!value) return ''
  const date = parseISO(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
