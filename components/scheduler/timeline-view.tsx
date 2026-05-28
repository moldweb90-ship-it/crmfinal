'use client'

import { useState } from 'react'
import {
  addDays,
  addMinutes,
  differenceInMinutes,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  setHours,
  setMinutes,
  startOfMonth,
  startOfToday,
  startOfWeek,
  subDays,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { Building2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, ExternalLink, Loader2, MapPin, Phone, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { db } from '@/lib/insforge'
import { useAppointments, useClinics, useDoctors, useGoogleCalendarEvents, useGoogleCalendarSources, usePatients } from '@/lib/hooks'
import { AppointmentDetailDialog } from '@/components/appointments/appointment-detail-dialog'
import { buildClinicSlots, clinicWorkSummary, getClinicHours, isAppointmentWithinClinicHours } from '@/lib/clinics'
import { dateLabel } from '@/lib/crm'

const toDateInput = (date: Date) => format(date, 'yyyy-MM-dd')

const fromDateAndTime = (dateValue: string, timeValue: string) => {
  const base = new Date(`${dateValue}T00:00:00`)
  const [hours, minutes] = timeValue.split(':').map(Number)
  return setMinutes(setHours(base, hours), minutes)
}

const statusClass: Record<string, string> = {
  planned: 'border-sky-200 bg-sky-50 text-sky-800',
  confirmed: 'border-teal-200 bg-teal-50 text-teal-800',
  in_progress: 'border-amber-200 bg-amber-50 text-amber-800',
  completed: 'border-slate-200 bg-slate-50 text-slate-600',
  cancelled: 'border-rose-200 bg-rose-50 text-rose-800',
  no_show: 'border-red-200 bg-red-50 text-red-800',
}

const minutesFromTime = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

const doctorShortName = (name?: string) =>
  String(name || '')
    .replace(/^Д-р\s+/i, '')
    .replace(/^Р”-СЂ\s+/i, '')
    .trim()

export function TimelineView() {
  const [currentDate, setCurrentDate] = useState(startOfToday())
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedAppt, setSelectedAppt] = useState<any>(null)
  const [selectedGoogleEvent, setSelectedGoogleEvent] = useState<any>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [googleDetailOpen, setGoogleDetailOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [newAppt, setNewAppt] = useState({
    date: toDateInput(startOfToday()),
    clinic_id: '',
    doctor_id: '',
    patient_name: '',
    service_name: '',
    start_time: '09:00',
    duration: '60',
  })

  const { doctors, isLoading: doctorsLoading } = useDoctors()
  const { clinics, isLoading: clinicsLoading } = useClinics()
  const { appointments, isLoading: apptsLoading, mutate: mutateAppts } = useAppointments()
  const { googleEvents, isLoading: googleLoading, mutate: mutateGoogleEvents } = useGoogleCalendarEvents()
  const { sources: googleSources, mutate: mutateGoogleSources } = useGoogleCalendarSources()
  const { patients, mutate: mutatePatients } = usePatients()
  const [selectedClinicId, setSelectedClinicId] = useState('')
  const [selectedDoctorId, setSelectedDoctorId] = useState('all')
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [syncingGoogle, setSyncingGoogle] = useState(false)

  const activeClinicId = selectedClinicId || clinics[0]?.id || ''
  const activeClinic = clinics.find((clinic: any) => clinic.id === activeClinicId)
  const formClinic = clinics.find((clinic: any) => clinic.id === newAppt.clinic_id) || activeClinic
  const workingHours = getClinicHours(currentDate)
  const slots = buildClinicSlots(currentDate)
  const isClosed = slots.length === 0
  const visibleDoctors = selectedDoctorId === 'all'
    ? doctors
    : doctors.filter((doctor: any) => doctor.id === selectedDoctorId)
  const scheduleDoctors = visibleDoctors.length ? visibleDoctors : doctors

  const dayAppointments = appointments.filter((appointment: any) =>
    appointment.start_time &&
    isSameDay(parseISO(appointment.start_time), currentDate) &&
    (!appointment.clinic_id || !activeClinicId || appointment.clinic_id === activeClinicId)
  )
  const dayGoogleEvents = googleEvents.filter((event: any) =>
    event.start_time &&
    isSameDay(parseISO(event.start_time), currentDate) &&
    (!event.clinic_id || !activeClinicId || event.clinic_id === activeClinicId)
  )
  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentDate, { weekStartsOn: 1 }),
    end: endOfWeek(currentDate, { weekStartsOn: 1 }),
  })
  const monthDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }),
  })
  const firstDoctorId = doctors[0]?.id

  const eventDoctorId = (event: any) => event.doctor_id || firstDoctorId
  const inActiveClinic = (event: any) => !event.clinic_id || !activeClinicId || event.clinic_id === activeClinicId
  const inSelectedDoctor = (event: any) => selectedDoctorId === 'all' || eventDoctorId(event) === selectedDoctorId
  const eventsForDay = (day: Date) => {
    const crm = appointments
      .filter((appointment: any) => appointment.start_time && isSameDay(parseISO(appointment.start_time), day) && inActiveClinic(appointment) && inSelectedDoctor(appointment))
      .map((appointment: any) => ({ ...appointment, source: 'crm', title: appointment.patient_name || appointment.notes, subtitle: appointment.service_name || 'Прием' }))
    const google = googleEvents
      .filter((event: any) => event.start_time && isSameDay(parseISO(event.start_time), day) && inActiveClinic(event) && inSelectedDoctor(event))
      .map((event: any) => ({ ...event, doctor_id: eventDoctorId(event), source: 'google', title: event.patient_name, subtitle: event.service_name || 'Google' }))
    return [...crm, ...google].sort((a: any, b: any) => parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime())
  }
  const visibleDayEvents = eventsForDay(currentDate)
  const dayStartMinutes = minutesFromTime(workingHours.start || '07:00')
  const dayEndMinutes = minutesFromTime(workingHours.end || '21:00')
  const timelineHeight = Math.max(1, dayEndMinutes - dayStartMinutes) * 1.35

  const openCreateDialog = (preset?: { doctor_id?: string; time?: string; date?: Date }) => {
    const date = preset?.date || currentDate
    setNewAppt((prev) => ({
      ...prev,
      date: toDateInput(date),
      clinic_id: activeClinicId || prev.clinic_id || clinics[0]?.id || '',
      doctor_id: preset?.doctor_id || prev.doctor_id || doctors[0]?.id || '',
      start_time: preset?.time || prev.start_time || '09:00',
      patient_name: '',
      service_name: '',
      duration: '60',
    }))
    setIsDialogOpen(true)
  }

  const handleCreateAppt = async () => {
    if (!newAppt.clinic_id || !newAppt.doctor_id || !newAppt.patient_name || !newAppt.date || !newAppt.start_time) return
    setLoading(true)
    try {
      const start = fromDateAndTime(newAppt.date, newAppt.start_time)
      if (!isAppointmentWithinClinicHours(start, newAppt.start_time, Number(newAppt.duration))) {
        alert('Запись выходит за пределы режима работы филиала.')
        return
      }
      const end = addMinutes(start, Number(newAppt.duration))
      const { error } = await db.from('appointments').insert([{
        clinic_id: newAppt.clinic_id,
        doctor_id: newAppt.doctor_id,
        patient_name: newAppt.patient_name,
        service_name: newAppt.service_name || 'Консультация',
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: 'planned',
        notes: newAppt.patient_name,
      }])

      if (error) throw error
      setCurrentDate(new Date(`${newAppt.date}T00:00:00`))
      await mutateAppts()
      setIsDialogOpen(false)
      setNewAppt({
        date: newAppt.date,
        clinic_id: newAppt.clinic_id,
        doctor_id: newAppt.doctor_id,
        patient_name: '',
        service_name: '',
        start_time: newAppt.start_time,
        duration: '60',
      })
    } catch (err) {
      console.error(err)
      alert('Ошибка создания записи')
    } finally {
      setLoading(false)
    }
  }

  const cellAppointments = (doctorId: string, slot: string) => {
    const slotStart = fromDateAndTime(toDateInput(currentDate), slot)
    const slotEnd = addMinutes(slotStart, 30)
    return dayAppointments.filter((appointment: any) => {
      const start = parseISO(appointment.start_time)
      return appointment.doctor_id === doctorId && start >= slotStart && start < slotEnd
    })
  }
  const cellGoogleEvents = (doctorId: string, slot: string) => {
    const slotStart = fromDateAndTime(toDateInput(currentDate), slot)
    const slotEnd = addMinutes(slotStart, 30)
    return dayGoogleEvents.filter((event: any) => {
      const start = parseISO(event.start_time)
      const assignedDoctorId = event.doctor_id || firstDoctorId
      return assignedDoctorId === doctorId && start >= slotStart && start < slotEnd
    })
  }

  const syncGoogleCalendars = async () => {
    const enabledSources = googleSources.filter((source: any) => source.is_active && source.ical_url)
    if (!enabledSources.length) {
      alert('Сначала добавьте Google Calendar в настройках и вставьте Secret iCal URL.')
      return
    }

    setSyncingGoogle(true)
    try {
      let imported = 0
      const existingKeys = new Set(googleEvents.map((event: any) => `${event.calendar_id}:${event.google_event_id}`))

      for (const source of enabledSources) {
        const response = await fetch('/api/google-calendar/ics-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: source.ical_url }),
        })
        const result = await response.json()
        if (!response.ok || result.result !== 'ok') throw new Error(result.message || 'Ошибка импорта Google Calendar')

        const rows = result.events
          .filter((event: any) => !existingKeys.has(`${source.calendar_id}:${event.google_event_id}`))
          .map((event: any) => ({
            ...event,
            source_id: source.id,
            calendar_id: source.calendar_id,
            doctor_id: source.doctor_id || null,
            clinic_id: source.clinic_id || null,
            last_seen_at: new Date().toISOString(),
          }))

        if (rows.length) {
          await db.from('google_calendar_events').insert(rows)
          rows.forEach((event: any) => existingKeys.add(`${event.calendar_id}:${event.google_event_id}`))
          imported += rows.length
        }
        await db.from('google_calendar_sources').update({ last_synced_at: new Date().toISOString() }).eq('id', source.id)
      }

      await mutateGoogleSources()
      window.dispatchEvent(new CustomEvent('lifedental-local-db-change'))
      alert(`Google Calendar синхронизирован. Новых событий: ${imported}.`)
    } catch (error: any) {
      alert(error?.message || 'Не удалось синхронизировать Google Calendar')
    } finally {
      setSyncingGoogle(false)
    }
  }

  const openDetail = (appointment: any) => {
    setSelectedAppt(appointment)
    setDetailOpen(true)
  }
  const openGoogleDetail = (event: any) => {
    setSelectedGoogleEvent(event)
    setGoogleDetailOpen(true)
  }

  const createAppointmentFromGoogle = async () => {
    if (!selectedGoogleEvent) return
    await db.from('appointments').insert([{
      clinic_id: selectedGoogleEvent.clinic_id || activeClinicId || null,
      doctor_id: selectedGoogleEvent.doctor_id || firstDoctorId || null,
      patient_name: selectedGoogleEvent.patient_name,
      service_name: selectedGoogleEvent.service_name || 'Прием',
      start_time: selectedGoogleEvent.start_time,
      end_time: selectedGoogleEvent.end_time,
      status: 'planned',
      notes: `Создано из Google Calendar: ${selectedGoogleEvent.description || selectedGoogleEvent.patient_name}`,
      google_event_id: selectedGoogleEvent.google_event_id,
    }])
    await mutateAppts()
    setGoogleDetailOpen(false)
  }

  const deleteAppointment = async (appointment: any) => {
    if (!appointment || !confirm(`Удалить запись "${appointment.patient_name || appointment.notes || 'пациент'}"?`)) return
    if (appointment.google_event_id) {
      await db.from('appointments').update({
        google_sync_status: 'pending_delete',
        deleted_locally_at: new Date().toISOString(),
      }).eq('id', appointment.id)
    }
    await db.from('appointments').delete().eq('id', appointment.id)
    await mutateAppts()
    setDetailOpen(false)
    setSelectedAppt(null)
  }

  const deleteGoogleEventFromCrm = async () => {
    if (!selectedGoogleEvent || !confirm('Убрать это Google-событие из CRM-вида? В самом Google оно останется, пока не подключен Google OAuth.')) return
    await db.from('google_calendar_events').delete().eq('id', selectedGoogleEvent.id)
    await mutateGoogleEvents()
    setGoogleDetailOpen(false)
    setSelectedGoogleEvent(null)
  }

  const openCalendarEvent = (event: any) => {
    if (event.source === 'google') openGoogleDetail(event)
    else openDetail(event)
  }

  const eventStyle = (event: any) => {
    const start = parseISO(event.start_time)
    const end = parseISO(event.end_time || event.start_time)
    const startMinutes = start.getHours() * 60 + start.getMinutes()
    const duration = Math.max(15, differenceInMinutes(end, start) || 30)
    return {
      top: Math.max(0, (startMinutes - dayStartMinutes) * 1.35),
      height: Math.max(26, duration * 1.35 - 4),
    }
  }

  const shiftDate = (direction: -1 | 1) => {
    const amount = viewMode === 'month' ? 30 : viewMode === 'week' ? 7 : 1
    setCurrentDate((date) => addDays(date, amount * direction))
  }

  if (doctorsLoading || clinicsLoading || apptsLoading || googleLoading) {
    return (
      <div className="flex h-[calc(100vh-140px)] items-center justify-center rounded-3xl bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-122px)] flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/90 shadow-[0_24px_70px_rgba(15,118,110,0.10)] backdrop-blur-xl md:h-[calc(100vh-140px)]">
      <div className="border-b border-slate-100 bg-gradient-to-r from-white via-cyan-50/70 to-emerald-50/80 p-3 md:p-4">
        <div className="flex items-start justify-between gap-2 md:hidden">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
              <CalendarIcon className="h-4 w-4 text-teal-600" />
              Расписание
            </h2>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge variant="outline" className="rounded-xl bg-white px-2 py-0.5 text-[11px]">
                {format(currentDate, 'd MMM', { locale: ru })}
              </Badge>
              <Badge variant="outline" className={cn('rounded-xl px-2 py-0.5 text-[11px]', isClosed ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-teal-200 bg-teal-50 text-teal-700')}>
                {isClosed ? 'Выходной' : `${workingHours.start} - ${workingHours.end}`}
              </Badge>
              {dayGoogleEvents.length > 0 && (
                <Badge variant="outline" className="rounded-xl border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700">
                  Google {dayGoogleEvents.length}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button variant="outline" className="h-9 rounded-2xl bg-white px-3 text-xs" onClick={() => setMobileFiltersOpen((open) => !open)}>
              {mobileFiltersOpen ? 'Скрыть' : 'Фильтры'}
            </Button>
            <Button onClick={() => openCreateDialog()} className="h-9 rounded-2xl bg-gradient-to-r from-teal-500 to-sky-500 px-3 text-xs text-white shadow-lg shadow-teal-500/20">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Запись
            </Button>
          </div>
        </div>

        <div className={cn('mt-3 flex-col gap-3 md:mt-0 md:flex md:flex-row md:items-center md:justify-between', mobileFiltersOpen ? 'flex' : 'hidden')}>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="hidden min-w-0 md:block">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-950 md:text-2xl">
              <CalendarIcon className="h-4 w-4 text-teal-600 md:h-5 md:w-5" />
              Расписание
            </h2>
            <p className="hidden text-sm text-slate-500 sm:block">Таблица визитов по филиалу, врачам и доступному времени.</p>
            {dayGoogleEvents.length > 0 && (
              <p className="mt-1 text-xs text-sky-600">Google Calendar: {dayGoogleEvents.length} событий за день</p>
            )}
          </div>
          <div className="flex rounded-2xl border bg-white p-1 shadow-sm">
            {[
              ['day', 'День'],
              ['week', 'Неделя'],
              ['month', 'Месяц'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setViewMode(key as 'day' | 'week' | 'month')}
                className={cn(
                  'rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                  viewMode === key ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Select value={activeClinicId} onValueChange={setSelectedClinicId}>
            <SelectTrigger className="h-10 w-full rounded-2xl bg-white sm:w-[280px] md:h-11">
              <SelectValue placeholder="Выберите филиал" />
            </SelectTrigger>
            <SelectContent>
              {clinics.map((clinic: any) => (
                <SelectItem key={clinic.id} value={clinic.id}>{clinic.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center rounded-2xl border bg-white p-1 shadow-sm">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl md:h-9 md:w-9" onClick={() => shiftDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" className="h-8 rounded-xl px-3 text-sm font-medium md:h-9 md:px-4" onClick={() => setCurrentDate(startOfToday())}>
              Сегодня
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl md:h-9 md:w-9" onClick={() => shiftDate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Input
            type="date"
            value={toDateInput(currentDate)}
            onChange={(event) => setCurrentDate(new Date(`${event.target.value}T00:00:00`))}
            className="h-10 w-[150px] rounded-2xl bg-white md:h-11 md:w-[170px]"
          />
          <Badge variant="outline" className="rounded-xl bg-white px-2.5 py-1 text-xs md:px-3 md:text-sm">
            {format(currentDate, 'EEEE, d MMMM', { locale: ru })}
          </Badge>
          <Badge variant="outline" className={cn('rounded-xl px-2.5 py-1 text-xs md:px-3 md:text-sm', isClosed ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-teal-200 bg-teal-50 text-teal-700')}>
            {isClosed ? 'Выходной' : `${workingHours.start} - ${workingHours.end}`}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={syncGoogleCalendars} disabled={syncingGoogle} className="h-10 rounded-2xl bg-white px-3 text-xs md:h-11 md:text-sm">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {syncingGoogle ? 'Синхронизация...' : <><span className="md:hidden">Google</span><span className="hidden md:inline">Синхронизировать Google</span></>}
          </Button>
          <Button onClick={() => openCreateDialog()} className="hidden h-10 rounded-2xl bg-gradient-to-r from-teal-500 to-sky-500 px-3 text-xs text-white shadow-lg shadow-teal-500/20 hover:from-teal-600 hover:to-sky-600 md:flex md:h-11 md:text-sm">
            <Plus className="mr-2 h-4 w-4" />
            Запись
          </Button>
        </div>
        </div>

        <div className={cn('mt-3 gap-2 overflow-x-auto pb-0.5 md:flex', mobileFiltersOpen ? 'flex' : 'hidden')}>
          <button
            type="button"
            onClick={() => setSelectedDoctorId('all')}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
              selectedDoctorId === 'all' ? 'border-teal-400 bg-teal-500 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600'
            )}
          >
            Все врачи
          </button>
          {doctors.map((doctor: any) => (
            <button
              type="button"
              key={doctor.id}
              onClick={() => setSelectedDoctorId(doctor.id)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                selectedDoctorId === doctor.id ? 'border-teal-400 bg-teal-500 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600'
              )}
            >
              {doctor.full_name?.replace(/^Д-р\s+/i, '').split(' ')[0] || doctor.full_name}
            </button>
          ))}
        </div>
      </div>

      {clinics.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-slate-500">
          Добавьте филиалы, чтобы расписание стало доступно.
        </div>
      ) : doctors.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-slate-500">
          Добавьте врачей, чтобы расписание стало доступно.
        </div>
      ) : isClosed ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-xl rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <Clock className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold text-slate-950">Воскресенье - выходной</h3>
            <p className="mt-2 text-slate-500">{clinicWorkSummary}</p>
          </div>
        </div>
      ) : viewMode === 'month' ? (
        <div className="flex-1 overflow-auto bg-slate-50/50 p-3">
          <div className="grid min-h-full grid-cols-7 overflow-hidden rounded-3xl border bg-white shadow-sm">
            {['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'].map((day) => (
              <div key={day} className="border-b border-r border-slate-100 px-2 py-2 text-center text-[11px] font-semibold text-slate-400">
                {day}
              </div>
            ))}
            {monthDays.map((day) => {
              const events = eventsForDay(day)
              const active = isSameDay(day, currentDate)
              return (
                <div
                  key={day.toISOString()}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setCurrentDate(day)
                    openCreateDialog({ date: day })
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setCurrentDate(day)
                      openCreateDialog({ date: day })
                    }
                  }}
                  className={cn(
                    'min-h-[94px] cursor-pointer border-r border-t border-slate-100 bg-white p-2 text-left transition hover:bg-cyan-50/60 md:min-h-[128px]',
                    !isSameMonth(day, currentDate) && 'bg-slate-50/70 text-slate-300',
                    active && 'bg-teal-50'
                  )}
                >
                  <div className={cn('mb-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold', active ? 'bg-teal-500 text-white' : 'text-slate-700')}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {events.slice(0, 3).map((event: any) => (
                      <button
                        key={`${event.source}-${event.id}`}
                        type="button"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation()
                          openCalendarEvent(event)
                        }}
                        className={cn('block w-full truncate rounded-lg px-2 py-1 text-left text-[10px] font-medium transition hover:shadow-sm', event.source === 'google' ? 'bg-sky-50 text-sky-700' : 'bg-teal-50 text-teal-800')}
                      >
                        {format(parseISO(event.start_time), 'HH:mm')} {event.title}
                      </button>
                    ))}
                    {events.length > 3 && (
                      <button
                        type="button"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation()
                          setCurrentDate(day)
                          setViewMode('day')
                        }}
                        className="text-[10px] font-semibold text-slate-400 hover:text-teal-700"
                      >
                        +{events.length - 3} еще
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : viewMode === 'week' ? (
        <div className="flex-1 overflow-auto bg-slate-50/50 p-3">
          <div className="grid min-w-[760px] grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const events = eventsForDay(day)
              return (
                <div key={day.toISOString()} className={cn('rounded-3xl border bg-white p-3 shadow-sm', isSameDay(day, currentDate) && 'border-teal-200 bg-teal-50/50')}>
                  <button type="button" onClick={() => { setCurrentDate(day); setViewMode('day') }} className="mb-3 w-full text-left">
                    <div className="text-xs font-semibold uppercase text-slate-400">{format(day, 'EEEEEE', { locale: ru })}</div>
                    <div className="text-lg font-semibold text-slate-950">{format(day, 'd MMM', { locale: ru })}</div>
                  </button>
                  <div className="space-y-2">
                    {events.length === 0 ? (
                      <div className="rounded-2xl border border-dashed p-4 text-center text-xs text-slate-300">Пусто</div>
                    ) : events.map((event: any) => (
                      <button
                        key={`${event.source}-${event.id}`}
                        type="button"
                        onClick={() => openCalendarEvent(event)}
                        className={cn('w-full rounded-2xl border p-2 text-left shadow-sm', event.source === 'google' ? 'border-sky-200 bg-sky-50 text-sky-900' : statusClass[event.status] || statusClass.planned)}
                      >
                        <div className="text-[11px] font-semibold opacity-75">{format(parseISO(event.start_time), 'HH:mm')} - {format(parseISO(event.end_time), 'HH:mm')}</div>
                        <div className="truncate text-sm font-semibold">{event.title}</div>
                        <div className="truncate text-xs opacity-70">{event.subtitle}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <>
        <div className="hidden flex-1 overflow-auto bg-slate-50/50 md:block">
          <div className="min-w-max">
            <div
              className="sticky top-0 z-20 grid border-b border-slate-200 bg-white/95 backdrop-blur"
              style={{ gridTemplateColumns: `76px repeat(${scheduleDoctors.length}, minmax(220px, 1fr))` }}
            >
              <div className="border-r border-slate-200 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Время</div>
              {scheduleDoctors.map((doctor: any) => (
                <div key={doctor.id} className="flex items-center gap-2 border-r border-slate-100 px-3 py-2">
                  <Avatar className="h-8 w-8 ring-2 ring-teal-50">
                    <AvatarImage src={doctor.photo_url || ''} />
                    <AvatarFallback className="bg-teal-50 text-xs font-semibold text-teal-700">{doctor.full_name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{doctor.full_name}</div>
                    <div className="truncate text-xs text-slate-500">{doctor.specialization}</div>
                  </div>
                </div>
              ))}
            </div>
            <div
              className="grid"
              style={{ gridTemplateColumns: `76px repeat(${scheduleDoctors.length}, minmax(220px, 1fr))`, height: timelineHeight }}
            >
              <div className="relative border-r border-slate-200 bg-white">
                {slots.map((slot) => (
                  <div key={slot} className="absolute left-0 right-0 border-t border-slate-100 px-2 pt-1 text-[11px] font-semibold text-slate-400" style={{ top: (minutesFromTime(slot) - dayStartMinutes) * 1.35 }}>
                    {slot}
                  </div>
                ))}
              </div>
              {scheduleDoctors.map((doctor: any) => {
                const doctorEvents = visibleDayEvents.filter((event: any) => eventDoctorId(event) === doctor.id)
                return (
                  <div key={doctor.id} className="relative border-r border-slate-100 bg-white/70">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => openCreateDialog({ doctor_id: doctor.id, time: slot })}
                        className="absolute left-0 right-0 border-t border-slate-100 transition hover:bg-cyan-50/70"
                        style={{ top: (minutesFromTime(slot) - dayStartMinutes) * 1.35, height: 40.5 }}
                        aria-label={`Создать запись ${doctor.full_name} ${slot}`}
                      />
                    ))}
                    {doctorEvents.map((event: any) => {
                      const style = eventStyle(event)
                      return (
                        <button
                          key={`${event.source}-${event.id}`}
                          type="button"
                          onClick={() => openCalendarEvent(event)}
                          className={cn(
                            'absolute left-2 right-2 z-10 overflow-hidden rounded-2xl border p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
                            event.source === 'google' ? 'border-sky-200 bg-sky-50 text-sky-900' : statusClass[event.status] || statusClass.planned
                          )}
                          style={style}
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold opacity-75">
                            <span>{format(parseISO(event.start_time), 'HH:mm')} - {format(parseISO(event.end_time), 'HH:mm')}</span>
                            {event.source === 'google' && <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px]">Google</span>}
                          </div>
                          <div className="mt-1 truncate text-sm font-semibold">{event.title}</div>
                          <div className="truncate text-xs opacity-70">{event.subtitle}</div>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="hidden">
          <div className="min-w-max">
            <div
              className="sticky top-0 z-20 grid border-b border-slate-200 bg-white/95 backdrop-blur"
              style={{ gridTemplateColumns: `260px repeat(${slots.length}, minmax(92px, 1fr))` }}
            >
              <div className="sticky left-0 z-30 border-r border-slate-200 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Врач / время
              </div>
              {slots.map((slot) => (
                <div key={slot} className="border-r border-slate-100 px-3 py-3 text-center text-sm font-semibold text-slate-700">
                  {slot}
                </div>
              ))}
            </div>

            {scheduleDoctors.map((doctor: any) => (
              <div
                key={doctor.id}
                className="grid min-h-[104px] border-b border-slate-100"
                style={{ gridTemplateColumns: `260px repeat(${slots.length}, minmax(92px, 1fr))` }}
              >
                <div className="sticky left-0 z-10 flex items-center gap-3 border-r border-slate-200 bg-white px-4 py-4">
                  <Avatar className="h-11 w-11 ring-4 ring-teal-50">
                    <AvatarImage src={doctor.photo_url || ''} />
                    <AvatarFallback className="bg-teal-50 font-semibold text-teal-700">
                      {doctor.full_name?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900">{doctor.full_name}</div>
                    <div className="truncate text-xs text-slate-500">{doctor.specialization}</div>
                  </div>
                </div>

                {slots.map((slot) => {
                  const appts = cellAppointments(doctor.id, slot)
                  const gcalEvents = cellGoogleEvents(doctor.id, slot)
                  return (
                    <button
                      key={`${doctor.id}-${slot}`}
                      type="button"
                      onClick={() => openCreateDialog({ doctor_id: doctor.id, time: slot })}
                      className="group min-h-[104px] border-r border-slate-100 bg-white/70 p-2 text-left align-top transition hover:bg-cyan-50/70 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-300"
                    >
                      {appts.length === 0 && gcalEvents.length === 0 ? (
                        <div className="flex h-full min-h-[82px] items-center justify-center rounded-2xl border border-dashed border-transparent text-xs text-slate-300 transition group-hover:border-teal-200 group-hover:text-teal-600">
                          + запись
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {gcalEvents.map((event: any) => {
                            const start = parseISO(event.start_time)
                            const end = parseISO(event.end_time)
                            return (
                              <div
                                key={event.id}
                                role="button"
                                tabIndex={0}
                                onClick={(clickEvent) => {
                                  clickEvent.stopPropagation()
                                  openGoogleDetail(event)
                                }}
                                className="rounded-2xl border border-sky-200 bg-sky-50 p-2 text-sky-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1 text-[11px] font-semibold opacity-80">
                                    <Clock className="h-3 w-3" />
                                    {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                                  </div>
                                  <Badge variant="outline" className="border-sky-200 bg-white text-[10px] text-sky-700">Google</Badge>
                                </div>
                                <div className="mt-1 truncate text-sm font-semibold">{event.patient_name}</div>
                                <div className="truncate text-xs opacity-75">{event.service_name || 'Прием'}</div>
                              </div>
                            )
                          })}
                          {appts.map((appointment: any) => {
                            const start = parseISO(appointment.start_time)
                            const end = parseISO(appointment.end_time)
                            return (
                              <div
                                key={appointment.id}
                                role="button"
                                tabIndex={0}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openDetail(appointment)
                                }}
                                className={cn(
                                  'rounded-2xl border p-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
                                  statusClass[appointment.status] || statusClass.planned
                                )}
                              >
                                <div className="flex items-center gap-1 text-[11px] font-semibold opacity-80">
                                  <Clock className="h-3 w-3" />
                                  {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                                </div>
                                <div className="mt-1 truncate text-sm font-semibold">{appointment.patient_name || appointment.notes}</div>
                                <div className="truncate text-xs opacity-75">{appointment.service_name || 'Консультация'}</div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50/50 md:hidden">
          <div className="min-w-max">
            <div
              className="sticky top-0 z-20 grid border-b border-slate-200 bg-white/95 backdrop-blur"
              style={{ gridTemplateColumns: `92px repeat(${slots.length}, minmax(76px, 1fr))` }}
            >
              <div className="sticky left-0 z-30 border-r border-slate-200 bg-white px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Врач
              </div>
              {slots.map((slot) => (
                <div key={slot} className="border-r border-slate-100 px-2 py-2 text-center text-xs font-semibold text-slate-700">
                  {slot}
                </div>
              ))}
            </div>

            {scheduleDoctors.map((doctor: any) => (
              <div
                key={doctor.id}
                className="grid min-h-[82px] border-b border-slate-100"
              style={{ gridTemplateColumns: `92px repeat(${slots.length}, minmax(76px, 1fr))` }}
            >
                <div className="sticky left-0 z-10 flex flex-col items-center justify-center gap-1 border-r border-slate-200 bg-white px-1.5 py-2 text-center">
                  <Avatar className="h-8 w-8 ring-2 ring-teal-50">
                    <AvatarImage src={doctor.photo_url || ''} />
                    <AvatarFallback className="bg-teal-50 text-xs font-semibold text-teal-700">
                      {doctor.full_name?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 max-w-full">
                    <div className="line-clamp-2 text-[10px] font-semibold leading-tight text-slate-900">
                      {doctor.full_name?.replace(/^Д-р\s+/i, '').replace(/^Р”-СЂ\s+/i, '') || doctor.full_name}
                    </div>
                    <div className="mt-0.5 truncate text-[9px] leading-tight text-slate-400">
                      {doctor.specialization?.split(' ')[0]}
                    </div>
                  </div>
                </div>

                {slots.map((slot) => {
                  const appts = cellAppointments(doctor.id, slot)
                  const gcalEvents = cellGoogleEvents(doctor.id, slot)
                  return (
                    <button
                      key={`${doctor.id}-${slot}`}
                      type="button"
                      onClick={() => openCreateDialog({ doctor_id: doctor.id, time: slot })}
                      className="group min-h-[82px] border-r border-slate-100 bg-white/70 p-1 text-left align-top transition hover:bg-cyan-50/70 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-300"
                    >
                      {appts.length === 0 && gcalEvents.length === 0 ? (
                        <div className="flex h-full min-h-[70px] items-center justify-center rounded-xl text-[10px] text-slate-300 transition group-hover:bg-teal-50 group-hover:text-teal-600">
                          +
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {gcalEvents.map((event: any) => {
                            const start = parseISO(event.start_time)
                            return (
                              <div
                                key={event.id}
                                role="button"
                                tabIndex={0}
                                onClick={(clickEvent) => {
                                  clickEvent.stopPropagation()
                                  openGoogleDetail(event)
                                }}
                                className="rounded-xl border border-sky-200 bg-sky-50 p-1.5 text-sky-900 shadow-sm"
                              >
                                <div className="text-[10px] font-semibold opacity-80">{format(start, 'HH:mm')}</div>
                                <div className="mt-0.5 truncate text-[11px] font-semibold">{event.patient_name}</div>
                                <div className="truncate text-[10px] opacity-75">Google</div>
                              </div>
                            )
                          })}
                          {appts.map((appointment: any) => {
                            const start = parseISO(appointment.start_time)
                            return (
                              <div
                                key={appointment.id}
                                role="button"
                                tabIndex={0}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openDetail(appointment)
                                }}
                                className={cn(
                                  'rounded-xl border p-1.5 shadow-sm',
                                  statusClass[appointment.status] || statusClass.planned
                                )}
                              >
                                <div className="text-[10px] font-semibold opacity-80">{format(start, 'HH:mm')}</div>
                                <div className="mt-0.5 truncate text-[11px] font-semibold">{appointment.patient_name || appointment.notes}</div>
                                <div className="truncate text-[10px] opacity-75">{appointment.service_name || 'Прием'}</div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        </>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Новая запись</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Филиал</Label>
              <Select value={newAppt.clinic_id} onValueChange={(clinic_id) => setNewAppt({ ...newAppt, clinic_id })}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите филиал" />
                </SelectTrigger>
                <SelectContent>
                  {clinics.map((clinic: any) => (
                    <SelectItem key={clinic.id} value={clinic.id}>{clinic.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formClinic && (
                <div className="rounded-2xl bg-teal-50 p-3 text-sm text-teal-900">
                  <div className="flex items-center gap-2 font-medium"><Building2 className="h-4 w-4" />{formClinic.name}</div>
                  <div className="mt-1 flex items-center gap-2"><MapPin className="h-4 w-4" />{formClinic.address}</div>
                  <div className="mt-1 flex items-center gap-2"><Phone className="h-4 w-4" />{formClinic.phone}</div>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Врач</Label>
              <Select value={newAppt.doctor_id} onValueChange={(doctor_id) => setNewAppt({ ...newAppt, doctor_id })}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите врача" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((doctor: any) => (
                    <SelectItem key={doctor.id} value={doctor.id}>{doctor.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Пациент</Label>
              <Input
                placeholder="Имя пациента"
                value={newAppt.patient_name}
                onChange={(event) => setNewAppt({ ...newAppt, patient_name: event.target.value })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Дата</Label>
                <Input
                  type="date"
                  value={newAppt.date}
                  onChange={(event) => {
                    const nextDate = new Date(`${event.target.value}T00:00:00`)
                    const nextSlots = buildClinicSlots(nextDate)
                    setNewAppt({ ...newAppt, date: event.target.value, start_time: nextSlots[0] || newAppt.start_time })
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label>Время начала</Label>
                <Input
                  type="time"
                  min={buildClinicSlots(new Date(`${newAppt.date}T00:00:00`))[0]}
                  max={getClinicHours(new Date(`${newAppt.date}T00:00:00`)).end}
                  step={1800}
                  value={newAppt.start_time}
                  onChange={(event) => setNewAppt({ ...newAppt, start_time: event.target.value })}
                />
                <span className="text-xs text-slate-500">
                  {buildClinicSlots(new Date(`${newAppt.date}T00:00:00`)).length
                    ? `Доступно: ${getClinicHours(new Date(`${newAppt.date}T00:00:00`)).start} - ${getClinicHours(new Date(`${newAppt.date}T00:00:00`)).end}`
                    : 'В этот день клиника закрыта'}
                </span>
              </div>
              <div className="grid gap-2">
                <Label>Длительность</Label>
                <Select value={newAppt.duration} onValueChange={(duration) => setNewAppt({ ...newAppt, duration })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 мин</SelectItem>
                    <SelectItem value="60">1 час</SelectItem>
                    <SelectItem value="90">1.5 часа</SelectItem>
                    <SelectItem value="120">2 часа</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Услуга</Label>
              <Input
                placeholder="Например: Чистка"
                value={newAppt.service_name}
                onChange={(event) => setNewAppt({ ...newAppt, service_name: event.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleCreateAppt} disabled={loading} className="bg-gradient-to-r from-teal-500 to-sky-500 text-white hover:from-teal-600 hover:to-sky-600">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AppointmentDetailDialog
        appointment={selectedAppt}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdate={mutateAppts}
        onPatientUpdate={mutatePatients}
        patients={patients}
        onDelete={deleteAppointment}
      />

      <Dialog open={googleDetailOpen} onOpenChange={setGoogleDetailOpen}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>Запись из Google Calendar</DialogTitle>
          </DialogHeader>
          {selectedGoogleEvent && (
            <div className="space-y-4 py-2">
              <div className="rounded-3xl border border-sky-100 bg-sky-50 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-2xl font-semibold text-slate-950">{selectedGoogleEvent.patient_name}</div>
                    <div className="mt-1 text-slate-600">{selectedGoogleEvent.service_name || 'Прием'}</div>
                  </div>
                  <Badge variant="outline" className="w-fit border-sky-200 bg-white text-sky-700">Google</Badge>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                  <InfoRow icon={Clock} label="Время" value={`${dateLabel(selectedGoogleEvent.start_time)} - ${format(parseISO(selectedGoogleEvent.end_time), 'HH:mm')}`} />
                  <InfoRow icon={CalendarIcon} label="Calendar ID" value={selectedGoogleEvent.calendar_id || '-'} />
                  <InfoRow icon={Building2} label="Филиал" value={activeClinic?.name || selectedGoogleEvent.clinic_id || '-'} />
                  <InfoRow icon={MapPin} label="Локация" value={selectedGoogleEvent.location || '-'} />
                </div>
              </div>

              {selectedGoogleEvent.description && (
                <div className="rounded-3xl border bg-white p-4">
                  <div className="mb-2 text-sm font-semibold text-slate-950">Описание</div>
                  <p className="whitespace-pre-wrap text-sm text-slate-600">{selectedGoogleEvent.description}</p>
                </div>
              )}

              <div className="rounded-3xl border bg-white p-4 text-sm text-slate-500">
                Эта запись пришла из Google Calendar. Ее можно оставить как внешнее событие или создать из нее полноценную CRM-запись.
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            {selectedGoogleEvent?.html_link && (
              <Button asChild variant="outline" className="mr-auto">
                <a href={selectedGoogleEvent.html_link} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Открыть в Google
                </a>
              </Button>
            )}
            <Button variant="outline" onClick={deleteGoogleEventFromCrm} className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700">Удалить из CRM</Button>
            <Button variant="outline" onClick={() => setGoogleDetailOpen(false)}>Закрыть</Button>
            <Button onClick={createAppointmentFromGoogle} className="bg-teal-600 hover:bg-teal-700">Создать CRM-запись</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="break-words font-medium text-slate-800">{value}</div>
    </div>
  )
}
