'use client'

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  DollarSign,
  Edit3,
  FileText,
  Loader2,
  Play,
  Save,
  Stethoscope,
  Trash2,
  User,
  XCircle,
} from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { db } from '@/lib/insforge'
import { useDoctors } from '@/lib/hooks'
import { ensurePatientAftercareTasks } from '@/lib/manager-automation'
import { money } from '@/lib/crm'
import { addMinutes } from 'date-fns'

const statusConfig: Record<string, { label: string; icon: any; tone: string }> = {
  planned: { label: 'Запланировано', icon: Calendar, tone: 'border-sky-200 bg-sky-50 text-sky-700' },
  confirmed: { label: 'Подтверждено', icon: CheckCircle2, tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  in_progress: { label: 'В процессе', icon: Play, tone: 'border-amber-200 bg-amber-50 text-amber-700' },
  completed: { label: 'Завершено', icon: CheckCircle2, tone: 'border-slate-200 bg-slate-100 text-slate-600' },
  cancelled: { label: 'Отменено', icon: XCircle, tone: 'border-red-200 bg-red-50 text-red-700' },
  no_show: { label: 'Не пришел', icon: AlertCircle, tone: 'border-rose-200 bg-rose-50 text-rose-700' },
}

const closedStatuses = ['completed', 'cancelled', 'no_show']

type Props = {
  appointment: any
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: () => void
  onPatientUpdate?: () => void
  patients?: any[]
  onDelete?: (appointment: any) => void
}

export function AppointmentDetailDialog({
  appointment,
  open,
  onOpenChange,
  onUpdate,
  onPatientUpdate,
  patients = [],
  onDelete,
}: Props) {
  const { doctors } = useDoctors()
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [currentStatus, setCurrentStatus] = useState(appointment?.status || 'planned')
  const [editData, setEditData] = useState({
    patient_name: appointment?.patient_name || appointment?.notes || '',
    doctor_id: appointment?.doctor_id || '',
    service_name: appointment?.service_name || '',
    date: appointment?.start_time ? format(parseISO(appointment.start_time), 'yyyy-MM-dd') : '',
    start_time: appointment?.start_time ? format(parseISO(appointment.start_time), 'HH:mm') : '',
    duration: appointment?.start_time && appointment?.end_time ? String(Math.max(15, Math.round((parseISO(appointment.end_time).getTime() - parseISO(appointment.start_time).getTime()) / 60000))) : '60',
    complaint: appointment?.complaint || '',
    treatment: appointment?.treatment || '',
    price: appointment?.price || 0,
    notes: appointment?.notes || '',
  })

  useEffect(() => {
    setCurrentStatus(appointment?.status || 'planned')
    setEditData({
      patient_name: appointment?.patient_name || appointment?.notes || '',
      doctor_id: appointment?.doctor_id || '',
      service_name: appointment?.service_name || '',
      date: appointment?.start_time ? format(parseISO(appointment.start_time), 'yyyy-MM-dd') : '',
      start_time: appointment?.start_time ? format(parseISO(appointment.start_time), 'HH:mm') : '',
      duration: appointment?.start_time && appointment?.end_time ? String(Math.max(15, Math.round((parseISO(appointment.end_time).getTime() - parseISO(appointment.start_time).getTime()) / 60000))) : '60',
      complaint: appointment?.complaint || '',
      treatment: appointment?.treatment || '',
      price: appointment?.price || 0,
      notes: appointment?.notes || '',
    })
    setIsEditing(false)
  }, [appointment])

  if (!appointment) return null

  const status = statusConfig[currentStatus] || statusConfig.planned
  const StatusIcon = status.icon
  const doctor = doctors.find((doctor: any) => doctor.id === appointment.doctor_id)
  const startTime = parseISO(appointment.start_time)
  const endTime = parseISO(appointment.end_time)

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true)
    try {
      await db.from('appointments').update({ status: newStatus }).eq('id', appointment.id)
      setCurrentStatus(newStatus)

      if (newStatus === 'completed' && appointment.patient_id && patients.length > 0) {
        const patient = patients.find((item: any) => item.id === appointment.patient_id)
        if (patient) {
          await db.from('patients').update({
            last_visit: new Date().toISOString().split('T')[0],
            total_spent: Number(patient.total_spent || 0) + Number(appointment.price || 0),
          }).eq('id', appointment.patient_id)
          await ensurePatientAftercareTasks({
            patientId: appointment.patient_id,
            patientName: patient.full_name || appointment.patient_name,
            sourceType: 'appointment',
            sourceId: appointment.id,
            checkupMonths: Number(patient.aftercare_checkup_months || 6),
          })
          onPatientUpdate?.()
        }
      }

      onUpdate()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveEdit = async () => {
    setLoading(true)
    try {
      const start = editData.date && editData.start_time ? new Date(`${editData.date}T${editData.start_time}:00`) : startTime
      const end = addMinutes(start, Number(editData.duration || 60))
      await db.from('appointments').update({
        patient_name: editData.patient_name,
        notes: editData.notes || editData.patient_name,
        doctor_id: editData.doctor_id,
        service_name: editData.service_name || 'Консультация',
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        complaint: editData.complaint,
        treatment: editData.treatment,
        price: Number(editData.price),
        google_sync_status: appointment.google_event_id ? 'pending_update' : appointment.google_sync_status,
        updated_at: new Date().toISOString(),
      }).eq('id', appointment.id)
      setIsEditing(false)
      onUpdate()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center justify-between gap-3">
            <span>Карточка записи</span>
            <Badge variant="outline" className={status.tone}>
              <StatusIcon className="mr-1 h-3 w-3" />
              {status.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 rounded-2xl border bg-slate-50/80 p-4 sm:grid-cols-2">
            <InfoLine icon={User} label="Пациент" value={appointment.patient_name || appointment.notes || 'Не указан'} />
            <InfoLine icon={Stethoscope} label="Врач" value={doctor?.full_name || 'Не назначен'} />
            <InfoLine
              icon={Calendar}
              label="Дата и время"
              value={`${format(startTime, 'd MMMM yyyy', { locale: ru })}, ${format(startTime, 'HH:mm')} - ${format(endTime, 'HH:mm')}`}
            />
            <InfoLine icon={FileText} label="Услуга" value={appointment.service_name || 'Консультация'} />
          </div>

          {isEditing ? (
            <div className="space-y-3 rounded-2xl border p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Пациент</Label>
                  <Input value={editData.patient_name} onChange={(event) => setEditData({ ...editData, patient_name: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Врач</Label>
                  <select className="h-10 rounded-xl border bg-white px-3 text-sm" value={editData.doctor_id} onChange={(event) => setEditData({ ...editData, doctor_id: event.target.value })}>
                    {doctors.map((doctor: any) => <option key={doctor.id} value={doctor.id}>{doctor.full_name}</option>)}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label>Дата</Label>
                  <Input type="date" value={editData.date} onChange={(event) => setEditData({ ...editData, date: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Начало</Label>
                  <Input type="time" step={900} value={editData.start_time} onChange={(event) => setEditData({ ...editData, start_time: event.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Длительность</Label>
                  <select className="h-10 rounded-xl border bg-white px-3 text-sm" value={editData.duration} onChange={(event) => setEditData({ ...editData, duration: event.target.value })}>
                    <option value="15">15 мин</option>
                    <option value="30">30 мин</option>
                    <option value="45">45 мин</option>
                    <option value="60">1 час</option>
                    <option value="90">1.5 часа</option>
                    <option value="120">2 часа</option>
                    <option value="180">3 часа</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label>Услуга</Label>
                  <Input value={editData.service_name} onChange={(event) => setEditData({ ...editData, service_name: event.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Жалоба / причина визита</Label>
                <Textarea value={editData.complaint} onChange={(event) => setEditData({ ...editData, complaint: event.target.value })} placeholder="Что беспокоит пациента..." />
              </div>
              <div className="grid gap-2">
                <Label>Проведенное лечение</Label>
                <Textarea value={editData.treatment} onChange={(event) => setEditData({ ...editData, treatment: event.target.value })} placeholder="Что сделали на приеме..." />
              </div>
              <div className="grid gap-2">
                <Label>Заметки менеджера</Label>
                <Textarea value={editData.notes} onChange={(event) => setEditData({ ...editData, notes: event.target.value })} placeholder="Договоренности, важные детали, следующий шаг..." />
              </div>
              <div className="grid gap-2">
                <Label>Стоимость, MDL</Label>
                <Input type="number" value={editData.price} onChange={(event) => setEditData({ ...editData, price: event.target.value })} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSaveEdit} disabled={loading} className="rounded-xl bg-teal-600 hover:bg-teal-700">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Сохранить
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)} className="rounded-xl">Отмена</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border p-4">
              <DetailText label="Жалоба" value={appointment.complaint} />
              <DetailText label="Лечение" value={appointment.treatment} />
              <DetailText label="Заметки" value={appointment.notes} />
              {Number(appointment.price || 0) > 0 && (
                <div className="flex items-center gap-2 font-semibold text-emerald-700">
                  <DollarSign className="h-4 w-4" />
                  {money(appointment.price)}
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="rounded-xl">
                <Edit3 className="mr-2 h-4 w-4" />
                Редактировать данные приема
              </Button>
            </div>
          )}

          <div className="rounded-2xl border p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Управление статусом</div>
            <div className="flex flex-wrap gap-2">
              {currentStatus !== 'confirmed' && !closedStatuses.includes(currentStatus) && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('confirmed')} disabled={loading} className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Подтвердить
                </Button>
              )}
              {currentStatus !== 'in_progress' && !closedStatuses.includes(currentStatus) && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('in_progress')} disabled={loading} className="rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50">
                  <Play className="mr-1 h-3 w-3" />
                  Начать
                </Button>
              )}
              {!closedStatuses.includes(currentStatus) && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('completed')} disabled={loading} className="rounded-xl border-teal-200 text-teal-700 hover:bg-teal-50">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Завершить
                </Button>
              )}
              {!closedStatuses.includes(currentStatus) && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('no_show')} disabled={loading} className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50">
                  <AlertCircle className="mr-1 h-3 w-3" />
                  Не пришел
                </Button>
              )}
              {!closedStatuses.includes(currentStatus) && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('cancelled')} disabled={loading} className="rounded-xl border-red-200 text-red-700 hover:bg-red-50">
                  <XCircle className="mr-1 h-3 w-3" />
                  Отменить
                </Button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4 sm:justify-between">
          {onDelete ? (
            <Button variant="outline" onClick={() => onDelete(appointment)} className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700">
              <Trash2 className="mr-2 h-4 w-4" />
              Удалить запись
            </Button>
          ) : <span />}
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InfoLine({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
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

function DetailText({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="text-sm text-slate-700">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}: </span>
      {value}
    </div>
  )
}
