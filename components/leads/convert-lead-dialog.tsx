'use client'

import { useEffect, useState } from 'react'
import { addMinutes, format, setHours, setMinutes } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ArrowRight, Calendar as CalendarIcon, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDoctors, usePatients } from '@/lib/hooks'
import { db } from '@/lib/insforge'
import { cn } from '@/lib/utils'

type Props = {
  lead: any
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ConvertLeadDialog({ lead, open, onOpenChange, onSuccess }: Props) {
  const { doctors } = useDoctors()
  const { patients, mutate: mutatePatients } = usePatients()
  const [loading, setLoading] = useState(false)
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [form, setForm] = useState({
    doctor_id: '',
    service_name: '',
    start_time: '10:00',
    duration: '60',
    price: '',
  })

  useEffect(() => {
    if (lead) {
      setDate(lead.preferred_date ? new Date(lead.preferred_date) : new Date())
      setForm((current) => ({
        ...current,
        service_name: lead.interested_service || '',
        start_time: lead.preferred_time || '10:00',
      }))
    }
  }, [lead])

  if (!lead) return null

  const handleConvert = async () => {
    if (!form.doctor_id || !date) return
    setLoading(true)
    try {
      let patientId = lead.converted_patient_id || null
      if (!patientId) {
        const phone = String(lead.phone || '').replace(/\D/g, '')
        const email = String(lead.email || '').trim().toLowerCase()
        const existing = patients.find((patient: any) => {
          const patientPhone = String(patient.phone || '').replace(/\D/g, '')
          const patientEmail = String(patient.email || '').trim().toLowerCase()
          return (phone && patientPhone && patientPhone === phone) || (email && patientEmail && patientEmail === email)
        })
        if (existing) {
          patientId = existing.id
        } else {
          const patientResult = await db.from('patients').insert([{
            full_name: lead.name,
            phone: lead.phone || null,
            email: lead.email || null,
            notes: lead.message || null,
            source: lead.source || null,
            payment_preference: lead.payment_preference || 'unknown',
            credit_months: lead.credit_months || null,
            has_3d_scan: Boolean(lead.has_3d_scan),
            scan_type: lead.scan_type || null,
            scan_url: lead.scan_url || null,
            scan_file_name: lead.scan_file_name || null,
            scan_file_mime: lead.scan_file_mime || null,
            scan_file_data: lead.scan_file_data || null,
          }]).select()
          patientId = patientResult.data?.[0]?.id
          await mutatePatients()
        }
      }
      const [hours, mins] = form.start_time.split(':').map(Number)
      const startTime = setMinutes(setHours(date, hours), mins)
      const endTime = addMinutes(startTime, Number(form.duration))

      const apptResult = await db.from('appointments').insert([{
        patient_id: patientId || null,
        patient_name: lead.name,
        doctor_id: form.doctor_id,
        service_name: form.service_name || 'Консультация',
        complaint: lead.message || null,
        source: lead.source || null,
        payment_preference: lead.payment_preference || null,
        price: form.price ? Number(form.price) : 0,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'planned',
      }]).select()

      const appointmentId = apptResult.data?.[0]?.id
      await db.from('leads').update({
        status: 'scheduled',
        converted_patient_id: patientId || null,
        converted_appointment_id: appointmentId || null,
      }).eq('id', lead.id)

      if (patientId) {
        await db.from('contact_history').insert([{
          patient_id: patientId,
          lead_id: lead.id,
          type: 'note',
          summary: 'Заявка конвертирована в пациента и запись',
        }])
      }

      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Создать запись из заявки
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </DialogTitle>
        </DialogHeader>
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="font-semibold text-slate-950">{lead.name}</div>
          <div className="text-sm text-slate-500">{lead.phone || lead.email || 'Контакт не указан'}</div>
          {lead.message && <div className="mt-2 text-sm text-slate-600">{lead.message}</div>}
        </div>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Врач *</Label>
            <Select value={form.doctor_id} onValueChange={(doctor_id) => setForm({ ...form, doctor_id })}>
              <SelectTrigger><SelectValue placeholder="Выберите врача" /></SelectTrigger>
              <SelectContent>{doctors.map((doctor: any) => <SelectItem key={doctor.id} value={doctor.id}>{doctor.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Дата</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('justify-start text-left font-normal', !date && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'PPP', { locale: ru }) : 'Выберите дату'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={date} onSelect={setDate} locale={ru} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label>Время</Label>
              <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Услуга</Label>
              <Input value={form.service_name} onChange={(e) => setForm({ ...form, service_name: e.target.value })} placeholder="Консультация" />
            </div>
            <div className="grid gap-2">
              <Label>Стоимость</Label>
              <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleConvert} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Создать запись
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
