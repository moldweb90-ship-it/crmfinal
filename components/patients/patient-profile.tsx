'use client'

import { useMemo, useState } from 'react'
import {
  BellRing, CalendarClock, CalendarDays, Cake, CheckCircle2, CreditCard, Edit3, FileText,
  Loader2, MessageCircle, Phone, Plus, Save, Sparkles, Trash2, UserRound, WalletCards, X
} from 'lucide-react'
import { addMonths, format, isFuture, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppointments, useContactHistory, usePatients, usePayments, useTasks, useTreatmentPlans } from '@/lib/hooks'
import { db } from '@/lib/insforge'
import { appointmentStatuses, dateLabel, money, planStatuses, taskStatuses } from '@/lib/crm'
import {
  birthdayLabel, dateOnly, isBirthdaySoon, isDateTodayOrOverdue, patientFocusReason,
  patientSources, patientStatusLabels, paymentPreferences, scanTypeLabel, sourceLabel
} from '@/lib/patient-crm'
import { ensurePatientAftercareTasks } from '@/lib/manager-automation'

export function PatientProfile({ patientId }: { patientId: string }) {
  const { patients, mutate: mutatePatients } = usePatients()
  const { appointments } = useAppointments()
  const { contacts, mutate: mutateContacts } = useContactHistory()
  const { plans } = useTreatmentPlans()
  const { payments } = usePayments()
  const { tasks, mutate: mutateTasks } = useTasks()
  const [note, setNote] = useState('')
  const [type, setType] = useState('call')
  const [taskTitle, setTaskTitle] = useState('')
  const [aftercareMonths, setAftercareMonths] = useState('6')
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [contactDraft, setContactDraft] = useState({ type: 'note', summary: '' })
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [taskDraft, setTaskDraft] = useState({
    title: '',
    description: '',
    due_at: '',
    status: 'open',
    priority: 'normal',
  })
  const patient = patients.find((item: any) => item.id === patientId)

  const [profile, setProfile] = useState<any>(null)

  const editable = useMemo(() => {
    if (!patient) return null
    return profile || {
      status: patient.status || 'active',
      source: patient.source || 'phone',
      preferred_contact_method: patient.preferred_contact_method || 'phone',
      birth_date: dateOnly(patient.birth_date),
      next_follow_up_at: patient.next_follow_up_at ? patient.next_follow_up_at.slice(0, 16) : '',
      planned_checkup_at: dateOnly(patient.planned_checkup_at),
      manager_notes: patient.manager_notes || '',
      notes: patient.notes || '',
      payment_preference: patient.payment_preference || 'unknown',
      credit_months: patient.credit_months ? String(patient.credit_months) : '12',
    }
  }, [patient, profile])

  if (!patient || !editable) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
  }

  const patientAppointments = appointments
    .filter((appt: any) => appt.patient_id === patientId)
    .sort((a: any, b: any) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
  const patientContacts = contacts.filter((contact: any) => contact.patient_id === patientId)
  const patientPlans = plans.filter((plan: any) => plan.patient_id === patientId)
  const patientPayments = payments.filter((payment: any) => payment.patient_id === patientId)
  const patientTasks = tasks.filter((task: any) => task.patient_id === patientId)
  const paid = patientPayments.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0)
  const planSum = patientPlans.reduce((sum: number, plan: any) => sum + Number(plan.amount || 0), 0)
  const lastVisit = patientAppointments.find((appt: any) => ['completed', 'in_progress', 'confirmed', 'planned'].includes(appt.status))
  const nextVisit = patientAppointments
    .filter((appt: any) => appt.start_time && isFuture(parseISO(appt.start_time)) && !['cancelled', 'no_show'].includes(appt.status))
    .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0]
  const focusReason = patientFocusReason({ ...patient, ...editable })
  const status = patientStatusLabels[editable.status] || patientStatusLabels.active
  const dueFollowUp = isDateTodayOrOverdue(editable.next_follow_up_at)
  const dueCheckup = isDateTodayOrOverdue(editable.planned_checkup_at)

  const updateProfile = async () => {
    await db.from('patients').update({
      status: editable.status,
      source: editable.source,
      preferred_contact_method: editable.preferred_contact_method,
      birth_date: editable.birth_date || null,
      next_follow_up_at: editable.next_follow_up_at ? new Date(editable.next_follow_up_at).toISOString() : null,
      planned_checkup_at: editable.planned_checkup_at || null,
      manager_notes: editable.manager_notes || null,
      notes: editable.notes || null,
      payment_preference: editable.payment_preference,
      credit_months: editable.payment_preference === 'credit' ? Number(editable.credit_months || 0) : null,
    }).eq('id', patientId)
    await mutatePatients()
    setProfile(null)
  }

  const addContact = async () => {
    if (!note.trim()) return
    await db.from('contact_history').insert([{
      patient_id: patientId,
      type,
      summary: note,
      direction: 'outgoing',
    }])
    setNote('')
    mutateContacts()
  }

  const startEditContact = (contact: any) => {
    setEditingContactId(contact.id)
    setContactDraft({
      type: contact.type || 'note',
      summary: contact.summary || '',
    })
  }

  const saveContact = async () => {
    if (!editingContactId || !contactDraft.summary.trim()) return
    await db.from('contact_history').update({
      type: contactDraft.type,
      summary: contactDraft.summary.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', editingContactId)
    setEditingContactId(null)
    mutateContacts()
  }

  const deleteContact = async (contactId: string) => {
    if (!confirm('Удалить запись из истории контактов?')) return
    await db.from('contact_history').delete().eq('id', contactId)
    mutateContacts()
  }

  const clearContacts = async () => {
    if (patientContacts.length === 0) return
    if (!confirm('Очистить всю историю контактов пациента?')) return
    await Promise.all(patientContacts.map((contact: any) => db.from('contact_history').delete().eq('id', contact.id)))
    mutateContacts()
  }

  const addQuickTask = async () => {
    const title = taskTitle.trim() || `Связаться с ${patient.full_name}`
    const due = editable.next_follow_up_at ? new Date(editable.next_follow_up_at) : new Date()
    await db.from('tasks').insert([{
      title,
      description: editable.manager_notes || null,
      due_at: due.toISOString(),
      priority: dueFollowUp ? 'high' : 'normal',
      patient_id: patientId,
      status: 'open',
    }])
    setTaskTitle('')
    mutateTasks()
  }

  const startEditTask = (task: any) => {
    setEditingTaskId(task.id)
    setTaskDraft({
      title: task.title || '',
      description: task.description || '',
      due_at: task.due_at ? task.due_at.slice(0, 16) : '',
      status: task.status || 'open',
      priority: task.priority || 'normal',
    })
  }

  const saveTask = async () => {
    if (!editingTaskId || !taskDraft.title.trim()) return
    await db.from('tasks').update({
      title: taskDraft.title.trim(),
      description: taskDraft.description.trim() || null,
      due_at: taskDraft.due_at ? new Date(taskDraft.due_at).toISOString() : null,
      status: taskDraft.status,
      priority: taskDraft.priority,
      updated_at: new Date().toISOString(),
    }).eq('id', editingTaskId)
    setEditingTaskId(null)
    mutateTasks()
  }

  const updateTaskStatus = async (taskId: string, status: string) => {
    await db.from('tasks').update({
      status,
      updated_at: new Date().toISOString(),
    }).eq('id', taskId)
    mutateTasks()
  }

  const deleteTask = async (taskId: string) => {
    if (!confirm('Удалить задачу пациента?')) return
    await db.from('tasks').delete().eq('id', taskId)
    mutateTasks()
  }

  const clearCompletedTasks = async () => {
    const completed = patientTasks.filter((task: any) => ['done', 'cancelled'].includes(task.status))
    if (completed.length === 0) return
    if (!confirm('Удалить все выполненные и отмененные задачи пациента?')) return
    await Promise.all(completed.map((task: any) => db.from('tasks').delete().eq('id', task.id)))
    mutateTasks()
  }

  const clearAllTasks = async () => {
    if (patientTasks.length === 0) return
    if (!confirm('Удалить все задачи пациента?')) return
    await Promise.all(patientTasks.map((task: any) => db.from('tasks').delete().eq('id', task.id)))
    mutateTasks()
  }

  const launchAftercare = async () => {
    await ensurePatientAftercareTasks({
      patientId,
      patientName: patient.full_name,
      sourceType: 'patient',
      sourceId: patientId,
      checkupMonths: Number(aftercareMonths),
    })
    await mutatePatients()
    await mutateTasks()
  }

  const setField = (key: string, value: any) => setProfile({ ...editable, [key]: value })

  return (
    <div className="space-y-6 animate-soft-in">
      <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-gradient-to-br from-white via-cyan-50 to-emerald-50 p-6 shadow-[0_24px_70px_rgba(15,118,110,0.10)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-teal-500 to-sky-500 text-2xl font-semibold text-white shadow-lg shadow-teal-500/20">
              {patient.full_name?.slice(0, 1)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{patient.full_name}</h1>
                <Badge variant="outline" className={status.tone}>{status.label}</Badge>
                {focusReason && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700"><BellRing className="mr-1 h-3 w-3" />{focusReason}</Badge>}
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                {patient.phone && <span><Phone className="mr-1 inline h-4 w-4" />{patient.phone}</span>}
                {patient.email && <span>{patient.email}</span>}
                <span>Источник: {sourceLabel(editable.source)}</span>
                <span>Оплата: {paymentPreferences[editable.payment_preference]?.label || 'Не уточнено'}</span>
                <span>ДР: {birthdayLabel(editable.birth_date)}</span>
              </div>
              {patient.has_3d_scan && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                    3D-снимок: {scanTypeLabel(patient.scan_type)}
                  </Badge>
                  {patient.scan_file_name && <Badge variant="outline">{patient.scan_file_name}</Badge>}
                  {patient.scan_url && <Badge variant="outline">есть ссылка</Badge>}
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:w-[420px]">
            <FocusPill icon={CalendarDays} label="Когда был" value={lastVisit ? dateLabel(lastVisit.start_time, 'd MMM yyyy') : 'Нет визитов'} />
            <FocusPill icon={CalendarClock} label="Когда должен прийти" value={nextVisit ? dateLabel(nextVisit.start_time, 'd MMM, HH:mm') : (editable.planned_checkup_at ? dateLabel(editable.planned_checkup_at, 'd MMM yyyy') : 'Не задано')} urgent={dueCheckup} />
            <FocusPill icon={BellRing} label="Следующий контакт" value={editable.next_follow_up_at ? dateLabel(editable.next_follow_up_at, 'd MMM, HH:mm') : 'Не задан'} urgent={dueFollowUp} />
            <FocusPill icon={Cake} label="День рождения" value={birthdayLabel(editable.birth_date)} urgent={isBirthdaySoon(editable.birth_date, 7)} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Потрачено" value={money(patient.total_spent || paid)} icon={CreditCard} />
        <StatCard label="Долг" value={money(patient.debt || 0)} icon={WalletCards} />
        <StatCard label="Планы лечения" value={money(planSum)} icon={FileText} />
        <StatCard label="Визиты" value={patientAppointments.length} icon={CalendarDays} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="crm-panel border-0">
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-teal-600" />Менеджерский контроль</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Статус пациента</Label>
              <Select value={editable.status} onValueChange={(value) => setField('status', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(patientStatusLabels).map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Откуда узнал</Label>
              <Select value={editable.source} onValueChange={(value) => setField('source', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{patientSources.map((source) => <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Следующий контакт</Label>
              <Input type="datetime-local" value={editable.next_follow_up_at} onChange={(e) => setField('next_follow_up_at', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Плановый осмотр</Label>
              <Input type="date" value={editable.planned_checkup_at} onChange={(e) => setField('planned_checkup_at', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Дата рождения</Label>
              <Input type="date" value={editable.birth_date} onChange={(e) => setField('birth_date', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Предпочитает связь</Label>
              <Select value={editable.preferred_contact_method} onValueChange={(value) => setField('preferred_contact_method', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Телефон</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Предпочтение оплаты</Label>
              <Select value={editable.payment_preference} onValueChange={(value) => setField('payment_preference', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(paymentPreferences).map(([key, payment]) => <SelectItem key={key} value={key}>{payment.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {editable.payment_preference === 'credit' && (
              <div className="grid gap-2">
                <Label>Кредит, месяцев</Label>
                <Select value={editable.credit_months} onValueChange={(value) => setField('credit_months', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 месяца</SelectItem>
                    <SelectItem value="6">6 месяцев</SelectItem>
                    <SelectItem value="12">12 месяцев</SelectItem>
                    <SelectItem value="24">24 месяца</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2 md:col-span-2">
              <Label>Заметки менеджера</Label>
              <Textarea rows={4} value={editable.manager_notes} onChange={(e) => setField('manager_notes', e.target.value)} placeholder="Что обещали, когда перезвонить, возражения, предпочтения..." />
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button onClick={updateProfile} className="bg-teal-600 hover:bg-teal-700"><Save className="mr-2 h-4 w-4" />Сохранить карточку</Button>
              <Button variant="outline" onClick={() => {
                const next = format(addMonths(new Date(), 6), "yyyy-MM-dd")
                setField('planned_checkup_at', next)
              }}>Осмотр через 6 месяцев</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="crm-panel border-0">
          <CardHeader><CardTitle>Быстрое действие</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border bg-white p-4">
              <Label>Задача менеджеру</Label>
              <div className="mt-2 flex gap-2">
                <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Позвонить, подтвердить, напомнить..." />
                <Button onClick={addQuickTask} className="bg-sky-600 hover:bg-sky-700"><Plus className="h-4 w-4" /></Button>
              </div>
              <p className="mt-2 text-xs text-slate-500">Дедлайн возьмется из поля “Следующий контакт”, если он указан.</p>
            </div>
            <div className="rounded-2xl border bg-gradient-to-br from-teal-50 to-white p-4">
              <Label>Автосопровождение после лечения</Label>
              <p className="mt-1 text-sm text-slate-500">
                Создаст задачи: проверить самочувствие через 1 и 3 дня, попросить отзыв, фото/видео отзыв, записать на проверку и вернуть на повторный визит.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <Select value={aftercareMonths} onValueChange={setAftercareMonths}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">Контроль через 2 месяца</SelectItem>
                    <SelectItem value="3">Контроль через 3 месяца</SelectItem>
                    <SelectItem value="5">Контроль через 5 месяцев</SelectItem>
                    <SelectItem value="6">Контроль через 6 месяцев</SelectItem>
                    <SelectItem value="12">Контроль через 12 месяцев</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={launchAftercare} className="bg-teal-600 hover:bg-teal-700">
                  <BellRing className="mr-2 h-4 w-4" />
                  Запустить
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border bg-white p-4">
              <Label>Новый контакт</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-[160px_1fr]">
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Звонок</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="note">Заметка</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addContact} variant="outline"><Plus className="mr-2 h-4 w-4" />Добавить</Button>
              </div>
              <Textarea className="mt-2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Что обсудили, что обещали, когда вернуться..." rows={4} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="timeline" className="space-y-5">
        <TabsList className="rounded-2xl bg-white p-1 shadow-sm">
          <TabsTrigger value="timeline" className="rounded-xl">Визиты</TabsTrigger>
          <TabsTrigger value="plans" className="rounded-xl">Планы</TabsTrigger>
          <TabsTrigger value="payments" className="rounded-xl">Оплаты</TabsTrigger>
          <TabsTrigger value="contacts" className="rounded-xl">Контакты</TabsTrigger>
          <TabsTrigger value="tasks" className="rounded-xl">Задачи</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <Card className="crm-panel border-0">
            <CardContent className="space-y-3 p-5">
              {patientAppointments.length === 0 ? <Empty text="Визитов пока нет" /> : patientAppointments.map((appt: any) => {
                const status = appointmentStatuses[appt.status] || appointmentStatuses.planned
                return (
                  <div key={appt.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{appt.service_name || 'Консультация'}</div>
                        <div className="text-sm text-slate-500">{dateLabel(appt.start_time)}</div>
                      </div>
                      <Badge variant="outline" className={status.tone}>{status.label}</Badge>
                    </div>
                    {(appt.complaint || appt.treatment) && (
                      <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                        {appt.complaint && <div><span className="text-slate-400">Жалоба:</span> {appt.complaint}</div>}
                        {appt.treatment && <div><span className="text-slate-400">Лечение:</span> {appt.treatment}</div>}
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <Card className="crm-panel border-0"><CardContent className="space-y-3 p-5">
            {patientPlans.length === 0 ? <Empty text="Планов лечения пока нет" /> : patientPlans.map((plan: any) => {
              const status = planStatuses[plan.status] || planStatuses.proposed
              return <div key={plan.id} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-4"><div><div className="font-semibold">{plan.title}</div><div className="text-sm text-slate-500">{plan.comment || dateLabel(plan.created_at, 'd MMM yyyy')}</div></div><div className="text-right"><div className="font-semibold">{money(plan.amount)}</div><Badge variant="outline" className={status.tone}>{status.label}</Badge></div></div></div>
            })}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="crm-panel border-0"><CardContent className="space-y-3 p-5">
            {patientPayments.length === 0 ? <Empty text="Оплат пока нет" /> : patientPayments.map((payment: any) => <div key={payment.id} className="flex items-center justify-between rounded-2xl border bg-white p-4 shadow-sm"><div><div className="font-semibold">{payment.method || 'Оплата'}</div><div className="text-sm text-slate-500">{dateLabel(payment.paid_at || payment.created_at)}</div></div><div className="font-semibold">{money(payment.amount)}</div></div>)}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="contacts">
          <Card className="crm-panel border-0">
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950">История контактов</div>
                  <div className="text-sm text-slate-500">Звонки, WhatsApp, SMS, заметки и обещания пациента.</div>
                </div>
                <Button variant="outline" size="sm" onClick={clearContacts} disabled={patientContacts.length === 0}>
                  <Trash2 className="mr-2 h-4 w-4" />Очистить
                </Button>
              </div>
              {patientContacts.length === 0 ? <Empty text="Контактов пока нет" /> : patientContacts.map((contact: any) => (
                <div key={contact.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                  {editingContactId === contact.id ? (
                    <div className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
                        <Select value={contactDraft.type} onValueChange={(value) => setContactDraft((draft) => ({ ...draft, type: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="call">Звонок</SelectItem>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="sms">SMS</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="note">Заметка</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={saveContact} className="bg-teal-600 hover:bg-teal-700"><Save className="mr-2 h-4 w-4" />Сохранить</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingContactId(null)}><X className="mr-2 h-4 w-4" />Отмена</Button>
                        </div>
                      </div>
                      <Textarea value={contactDraft.summary} onChange={(e) => setContactDraft((draft) => ({ ...draft, summary: e.target.value }))} rows={3} />
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Badge variant="outline"><MessageCircle className="mr-1 h-3 w-3" />{contact.type || 'note'}</Badge>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500">{dateLabel(contact.created_at)}</span>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEditContact(contact)}><Edit3 className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600 hover:text-rose-700" onClick={() => deleteContact(contact.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-slate-700">{contact.summary}</p>
                    </>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card className="crm-panel border-0">
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950">Задачи пациента</div>
                  <div className="text-sm text-slate-500">Напоминания, повторные касания и контроль после лечения.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={clearCompletedTasks} disabled={!patientTasks.some((task: any) => ['done', 'cancelled'].includes(task.status))}>Очистить готовые</Button>
                  <Button variant="outline" size="sm" onClick={clearAllTasks} disabled={patientTasks.length === 0}>
                    <Trash2 className="mr-2 h-4 w-4" />Все задачи
                  </Button>
                </div>
              </div>
              {patientTasks.length === 0 ? <Empty text="Задач по пациенту пока нет" /> : patientTasks.map((task: any) => {
                const status = taskStatuses[task.status] || taskStatuses.open
                return (
                  <div key={task.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                    {editingTaskId === task.id ? (
                      <div className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="grid gap-2">
                            <Label>Название</Label>
                            <Input value={taskDraft.title} onChange={(e) => setTaskDraft((draft) => ({ ...draft, title: e.target.value }))} />
                          </div>
                          <div className="grid gap-2">
                            <Label>Дедлайн</Label>
                            <Input type="datetime-local" value={taskDraft.due_at} onChange={(e) => setTaskDraft((draft) => ({ ...draft, due_at: e.target.value }))} />
                          </div>
                          <div className="grid gap-2">
                            <Label>Статус</Label>
                            <Select value={taskDraft.status} onValueChange={(value) => setTaskDraft((draft) => ({ ...draft, status: value }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Открыта</SelectItem>
                                <SelectItem value="in_progress">В работе</SelectItem>
                                <SelectItem value="done">Готово</SelectItem>
                                <SelectItem value="cancelled">Отмена</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Приоритет</Label>
                            <Select value={taskDraft.priority} onValueChange={(value) => setTaskDraft((draft) => ({ ...draft, priority: value }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Низкий</SelectItem>
                                <SelectItem value="normal">Обычный</SelectItem>
                                <SelectItem value="high">Высокий</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Textarea value={taskDraft.description} onChange={(e) => setTaskDraft((draft) => ({ ...draft, description: e.target.value }))} placeholder="Комментарий для менеджера" rows={3} />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={saveTask} className="bg-teal-600 hover:bg-teal-700"><Save className="mr-2 h-4 w-4" />Сохранить</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingTaskId(null)}><X className="mr-2 h-4 w-4" />Отмена</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-950">{task.title}</div>
                            <div className="mt-1 text-sm text-slate-500">{task.due_at ? dateLabel(task.due_at) : 'Без дедлайна'}</div>
                            {task.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{task.description}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={status.tone}>{status.label}</Badge>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEditTask(task)}><Edit3 className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600 hover:text-rose-700" onClick={() => deleteTask(task.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, 'in_progress')} disabled={task.status === 'in_progress'}>В работу</Button>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => updateTaskStatus(task.id, 'done')} disabled={task.status === 'done'}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />Готово
                          </Button>
                          <Button size="sm" variant="ghost" className="text-slate-500" onClick={() => updateTaskStatus(task.id, 'cancelled')} disabled={task.status === 'cancelled'}>Отменить</Button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function FocusPill({ label, value, icon: Icon, urgent }: any) {
  return (
    <div className={`rounded-2xl border bg-white/85 p-3 shadow-sm ${urgent ? 'border-amber-200 ring-2 ring-amber-100' : 'border-white'}`}>
      <div className="flex items-center gap-2 text-xs text-slate-500"><Icon className="h-4 w-4" />{label}</div>
      <div className="mt-1 truncate font-semibold text-slate-950">{value}</div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon }: any) {
  return (
    <Card className="crm-panel border-0">
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <div className="mt-2 text-2xl font-semibold">{value}</div>
        </div>
        <div className="rounded-2xl bg-teal-50 p-3 text-teal-700"><Icon className="h-5 w-5" /></div>
      </CardContent>
    </Card>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed bg-white/70 p-8 text-center text-sm text-slate-500">{text}</div>
}
