'use client'

import { useMemo, useState } from 'react'
import { format, isAfter, isBefore, isSameDay, isToday, isTomorrow, parseISO, startOfDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock3,
  DollarSign,
  Eye,
  FileText,
  Filter,
  Loader2,
  MoreHorizontal,
  Play,
  Plus,
  RotateCcw,
  Search,
  Stethoscope,
  Trash2,
  XCircle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { useAppointments, useClinics, useDoctors, usePatients } from '@/lib/hooks'
import { db } from '@/lib/insforge'
import { AddAppointmentDialog } from './add-appointment-dialog'
import { AppointmentDetailDialog } from './appointment-detail-dialog'
import { ensurePatientAftercareTasks } from '@/lib/manager-automation'
import { money } from '@/lib/crm'
import { cn } from '@/lib/utils'

const statusConfig: Record<string, { label: string; icon: any; tone: string }> = {
  planned: { label: 'Запланировано', icon: Calendar, tone: 'border-sky-200 bg-sky-50 text-sky-700' },
  confirmed: { label: 'Подтверждено', icon: CheckCircle2, tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  in_progress: { label: 'В процессе', icon: Play, tone: 'border-amber-200 bg-amber-50 text-amber-700' },
  completed: { label: 'Завершено', icon: CheckCircle2, tone: 'border-slate-200 bg-slate-100 text-slate-600' },
  cancelled: { label: 'Отменено', icon: XCircle, tone: 'border-red-200 bg-red-50 text-red-700' },
  no_show: { label: 'Не пришел', icon: AlertCircle, tone: 'border-rose-200 bg-rose-50 text-rose-700' },
}

const closedStatuses = ['completed', 'cancelled', 'no_show']

export function AppointmentsList() {
  const { appointments, isLoading, mutate } = useAppointments()
  const { doctors } = useDoctors()
  const { clinics } = useClinics()
  const { patients, mutate: mutatePatients } = usePatients()
  const [statusFilter, setStatusFilter] = useState('all')
  const [doctorFilter, setDoctorFilter] = useState('all')
  const [clinicFilter, setClinicFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('upcoming')
  const [query, setQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedAppt, setSelectedAppt] = useState<any>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const getDoctorName = (doctorId: string) => doctors.find((doctor: any) => doctor.id === doctorId)?.full_name || 'Врач не назначен'
  const getClinicName = (clinicId: string) => clinics.find((clinic: any) => clinic.id === clinicId)?.name || ''

  const filteredAppointments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const today = startOfDay(new Date())

    return appointments
      .filter((appt: any) => {
        const start = appt.start_time ? parseISO(appt.start_time) : null
        const haystack = `${appt.patient_name || ''} ${appt.notes || ''} ${appt.service_name || ''} ${appt.complaint || ''} ${getDoctorName(appt.doctor_id)} ${getClinicName(appt.clinic_id)}`.toLowerCase()

        if (normalizedQuery && !haystack.includes(normalizedQuery)) return false
        if (statusFilter !== 'all' && appt.status !== statusFilter) return false
        if (doctorFilter !== 'all' && appt.doctor_id !== doctorFilter) return false
        if (clinicFilter !== 'all' && appt.clinic_id !== clinicFilter) return false
        if (dateFilter === 'today' && !(start && isToday(start))) return false
        if (dateFilter === 'tomorrow' && !(start && isTomorrow(start))) return false
        if (dateFilter === 'past' && !(start && isBefore(start, today))) return false
        if (dateFilter === 'upcoming' && !(start && (isAfter(start, today) || isSameDay(start, today)) && !closedStatuses.includes(appt.status))) return false
        return true
      })
      .sort((a: any, b: any) => new Date(a.start_time || 0).getTime() - new Date(b.start_time || 0).getTime())
  }, [appointments, query, statusFilter, doctorFilter, clinicFilter, dateFilter, doctors, clinics])

  const handleStatusChange = async (apptId: string, newStatus: string, appt: any) => {
    await db.from('appointments').update({ status: newStatus }).eq('id', apptId)

    if (newStatus === 'completed' && appt.patient_id) {
      const patient = patients.find((p: any) => p.id === appt.patient_id)
      if (patient) {
        await db.from('patients').update({
          last_visit: new Date().toISOString().split('T')[0],
          total_spent: Number(patient.total_spent || 0) + Number(appt.price || 0),
        }).eq('id', appt.patient_id)
        await ensurePatientAftercareTasks({
          patientId: appt.patient_id,
          patientName: patient.full_name || appt.patient_name,
          sourceType: 'appointment',
          sourceId: appt.id,
          checkupMonths: Number(patient.aftercare_checkup_months || 6),
        })
        mutatePatients()
      }
    }

    mutate()
  }

  const deleteAppointment = async (appt: any) => {
    const ok = window.confirm(`Удалить запись "${appt.patient_name || appt.notes || 'Пациент'}"?`)
    if (!ok) return
    await db.from('appointments').delete().eq('id', appt.id)
    if (selectedAppt?.id === appt.id) {
      setDetailOpen(false)
      setSelectedAppt(null)
    }
    mutate()
  }

  const resetFilters = () => {
    setStatusFilter('all')
    setDoctorFilter('all')
    setClinicFilter('all')
    setDateFilter('upcoming')
    setQuery('')
  }

  const openDetail = (appt: any) => {
    setSelectedAppt(appt)
    setDetailOpen(true)
  }

  const stats = [
    { label: 'Сегодня', value: appointments.filter((appt: any) => appt.start_time && isToday(parseISO(appt.start_time))).length, tone: 'text-sky-700 bg-sky-50' },
    { label: 'Завтра', value: appointments.filter((appt: any) => appt.start_time && isTomorrow(parseISO(appt.start_time))).length, tone: 'text-emerald-700 bg-emerald-50' },
    { label: 'В процессе', value: appointments.filter((appt: any) => appt.status === 'in_progress').length, tone: 'text-amber-700 bg-amber-50' },
    { label: 'Завершено', value: appointments.filter((appt: any) => appt.status === 'completed').length, tone: 'text-slate-700 bg-slate-100' },
    { label: 'Не пришли', value: appointments.filter((appt: any) => appt.status === 'no_show').length, tone: 'text-rose-700 bg-rose-50' },
  ]

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
  }

  return (
    <div className="space-y-5 animate-soft-in">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Записи</h1>
          <p className="mt-1 text-slate-500">Контроль приемов: статус, врач, филиал, пациент, оплата и результат визита.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-11 rounded-2xl bg-white">
            <a href="/schedule"><Calendar className="mr-2 h-4 w-4" />Расписание</a>
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="h-11 rounded-2xl bg-gradient-to-r from-teal-500 to-sky-500 text-white hover:from-teal-600 hover:to-sky-600">
            <Plus className="mr-2 h-4 w-4" />
            Новая запись
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label} className="crm-panel border-0">
            <CardContent className="flex items-center justify-between p-4">
              <span className="text-sm font-medium text-slate-500">{stat.label}</span>
              <span className={`rounded-xl px-3 py-1 text-2xl font-semibold ${stat.tone}`}>{stat.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="crm-panel border-0">
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1fr_150px_170px_170px_170px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск пациента, услуги, врача..." className="h-11 rounded-2xl bg-white pl-9" />
          </div>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-11 rounded-2xl bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">Предстоящие</SelectItem>
              <SelectItem value="today">Сегодня</SelectItem>
              <SelectItem value="tomorrow">Завтра</SelectItem>
              <SelectItem value="past">Прошедшие</SelectItem>
              <SelectItem value="all">Все даты</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 rounded-2xl bg-white"><Filter className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              {Object.entries(statusConfig).map(([key, status]) => <SelectItem key={key} value={key}>{status.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={doctorFilter} onValueChange={setDoctorFilter}>
            <SelectTrigger className="h-11 rounded-2xl bg-white"><SelectValue placeholder="Врач" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все врачи</SelectItem>
              {doctors.map((doctor: any) => <SelectItem key={doctor.id} value={doctor.id}>{doctor.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={clinicFilter} onValueChange={setClinicFilter}>
            <SelectTrigger className="h-11 rounded-2xl bg-white"><SelectValue placeholder="Филиал" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все филиалы</SelectItem>
              {clinics.map((clinic: any) => <SelectItem key={clinic.id} value={clinic.id}>{clinic.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={resetFilters} className="h-11 rounded-2xl bg-white">
            <RotateCcw className="mr-2 h-4 w-4" />
            Сброс
          </Button>
        </CardContent>
      </Card>

      <Card className="crm-panel border-0 overflow-hidden">
        <CardContent className="p-0">
          {filteredAppointments.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Calendar className="mx-auto mb-4 h-12 w-12 text-slate-300" />
              <h3 className="text-lg font-semibold text-slate-700">Записей по фильтрам нет</h3>
              <p className="mb-4 text-sm text-slate-400">Создайте запись или сбросьте фильтры.</p>
              <Button onClick={() => setDialogOpen(true)} className="rounded-2xl bg-teal-600 hover:bg-teal-700">
                <Plus className="mr-2 h-4 w-4" />
                Создать запись
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {filteredAppointments.map((appt: any) => {
                const status = statusConfig[appt.status] || statusConfig.planned
                const StatusIcon = status.icon
                const startTime = parseISO(appt.start_time)
                const endTime = parseISO(appt.end_time)
                const isLate = isBefore(startTime, new Date()) && !closedStatuses.includes(appt.status)

                return (
                  <div key={appt.id} className={cn('grid gap-3 p-4 transition hover:bg-white/70 xl:grid-cols-[90px_1fr_220px_170px_auto]', isLate && 'bg-rose-50/35')}>
                    <button type="button" onClick={() => openDetail(appt)} className="text-left">
                      <div className="text-2xl font-semibold text-slate-950">{format(startTime, 'HH:mm')}</div>
                      <div className="text-xs text-slate-500">{format(startTime, 'd MMM', { locale: ru })}</div>
                    </button>

                    <button type="button" onClick={() => openDetail(appt)} className="min-w-0 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-semibold text-slate-950">{appt.patient_name || appt.notes || 'Пациент не указан'}</h3>
                        <Badge variant="outline" className={status.tone}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {status.label}
                        </Badge>
                        {isLate && <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">требует внимания</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                        <span><Stethoscope className="mr-1 inline h-3.5 w-3.5" />{getDoctorName(appt.doctor_id)}</span>
                        <span><FileText className="mr-1 inline h-3.5 w-3.5" />{appt.service_name || 'Консультация'}</span>
                        {appt.clinic_id && <span>{getClinicName(appt.clinic_id)}</span>}
                      </div>
                    </button>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <Badge variant="outline" className="bg-white">
                        <Clock3 className="mr-1 h-3 w-3" />
                        {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
                      </Badge>
                      {Number(appt.price || 0) > 0 && (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                          <DollarSign className="mr-1 h-3 w-3" />
                          {money(appt.price)}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
                      {appt.status === 'planned' && <Button size="sm" variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => handleStatusChange(appt.id, 'confirmed', appt)}>Подтвердить</Button>}
                      {!closedStatuses.includes(appt.status) && appt.status !== 'in_progress' && <Button size="sm" variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => handleStatusChange(appt.id, 'in_progress', appt)}>Начать</Button>}
                      {appt.status === 'in_progress' && <Button size="sm" variant="outline" className="border-teal-200 text-teal-700 hover:bg-teal-50" onClick={() => handleStatusChange(appt.id, 'completed', appt)}>Завершить</Button>}
                    </div>

                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => openDetail(appt)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-xl">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openDetail(appt)}><Eye className="h-4 w-4" />Открыть карточку</DropdownMenuItem>
                          {!closedStatuses.includes(appt.status) && <DropdownMenuItem onClick={() => handleStatusChange(appt.id, 'no_show', appt)}><AlertCircle className="h-4 w-4" />Не пришел</DropdownMenuItem>}
                          {!closedStatuses.includes(appt.status) && <DropdownMenuItem onClick={() => handleStatusChange(appt.id, 'cancelled', appt)}><XCircle className="h-4 w-4" />Отменить</DropdownMenuItem>}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => deleteAppointment(appt)} className="text-rose-600 focus:text-rose-600"><Trash2 className="h-4 w-4" />Удалить</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AddAppointmentDialog open={dialogOpen} onOpenChange={setDialogOpen} onSuccess={() => { mutate(); setDialogOpen(false) }} />

      <AppointmentDetailDialog
        appointment={selectedAppt}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdate={mutate}
        onPatientUpdate={mutatePatients}
        patients={patients}
        onDelete={deleteAppointment}
      />
    </div>
  )
}
