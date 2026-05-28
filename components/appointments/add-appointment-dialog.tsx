'use client'

import { useState } from 'react'
import { format, setHours, setMinutes, addMinutes } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useClinics, useDoctors, usePatients } from '@/lib/hooks'
import { db } from '@/lib/insforge'
import { ru } from 'date-fns/locale'
import { buildClinicSlots, clinicWorkSummary, getClinicHours, isAppointmentWithinClinicHours } from '@/lib/clinics'
import { patientSources } from '@/lib/patient-crm'

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

const initialForm = {
    clinic_id: '',
    patient_id: '',
    patient_name: '',
    patient_phone: '',
    source: 'phone',
    doctor_id: '',
    service_name: '',
    complaint: '',
    treatment: '',
    price: '',
    start_time: '09:00',
    duration: '60'
}

export function AddAppointmentDialog({ open, onOpenChange, onSuccess }: Props) {
    const { clinics } = useClinics()
    const { doctors } = useDoctors()
    const { patients, mutate: mutatePatients } = usePatients()
    const [loading, setLoading] = useState(false)
    const [date, setDate] = useState<Date | undefined>(new Date())
    const [form, setForm] = useState(initialForm)

    const handlePatientSelect = (patientId: string) => {
        const patient = patients.find((p: any) => p.id === patientId)
        setForm({
            ...form,
            patient_id: patientId,
            patient_name: patient?.full_name || '',
            patient_phone: patient?.phone || '',
            source: patient?.source || form.source
        })
    }

    const handleSubmit = async () => {
        const clinicId = form.clinic_id || clinics[0]?.id
        if (!clinicId || !form.doctor_id || !form.patient_name || !date) return
        setLoading(true)

        try {
            const [hours, mins] = form.start_time.split(':').map(Number)
            const startTime = setMinutes(setHours(date, hours), mins)
            if (!isAppointmentWithinClinicHours(startTime, form.start_time, Number(form.duration))) {
                alert('Запись выходит за пределы режима работы филиала.')
                return
            }
            const endTime = addMinutes(startTime, Number(form.duration))
            let patientId = form.patient_id || null

            if (!patientId && form.patient_name.trim()) {
                const patientResult = await db.from('patients').insert([{
                    full_name: form.patient_name.trim(),
                    phone: form.patient_phone || null,
                    source: form.source || null,
                    status: 'active',
                    notes: form.complaint || null,
                    total_spent: 0,
                    debt: 0,
                }]).select()
                patientId = patientResult.data?.[0]?.id || null
                await mutatePatients()
            } else if (patientId) {
                const patient = patients.find((item: any) => item.id === patientId)
                if (patient && !patient.source && form.source) {
                    await db.from('patients').update({ source: form.source }).eq('id', patientId)
                    await mutatePatients()
                }
            }

            await db.from('appointments').insert([{
                clinic_id: clinicId,
                patient_id: patientId,
                patient_name: form.patient_name,
                source: form.source || null,
                doctor_id: form.doctor_id,
                service_name: form.service_name || 'Консультация',
                complaint: form.complaint || null,
                treatment: form.treatment || null,
                price: form.price ? Number(form.price) : 0,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                status: 'planned'
            }])

            onSuccess()
            setForm({ ...initialForm, clinic_id: clinicId })
        } catch (err) {
            console.error('Error creating appointment:', err)
            alert('Ошибка создания записи')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
                <DialogHeader>
                    <DialogTitle>Новая запись на прием</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Филиал *</Label>
                        <Select value={form.clinic_id || clinics[0]?.id || ''} onValueChange={(v) => setForm({ ...form, clinic_id: v })}>
                            <SelectTrigger><SelectValue placeholder="Выберите филиал" /></SelectTrigger>
                            <SelectContent>
                                {clinics.map((clinic: any) => (
                                    <SelectItem key={clinic.id} value={clinic.id}>{clinic.name} · {clinic.address}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="text-xs text-slate-500">{clinicWorkSummary}</span>
                    </div>

                    <div className="grid gap-2">
                        <Label>Пациент</Label>
                        <Select value={form.patient_id} onValueChange={handlePatientSelect}>
                            <SelectTrigger><SelectValue placeholder="Выберите пациента" /></SelectTrigger>
                            <SelectContent>
                                {patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <span className="text-xs text-slate-500">или введите нового пациента вручную:</span>
                        <Input placeholder="ФИО пациента" value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label>Телефон пациента</Label>
                            <Input placeholder="+373 ..." value={form.patient_phone} onChange={(e) => setForm({ ...form, patient_phone: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Откуда узнал</Label>
                            <Select value={form.source} onValueChange={(source) => setForm({ ...form, source })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {patientSources.map((source) => <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Врач *</Label>
                        <Select value={form.doctor_id} onValueChange={(v) => setForm({ ...form, doctor_id: v })}>
                            <SelectTrigger><SelectValue placeholder="Выберите врача" /></SelectTrigger>
                            <SelectContent>{doctors.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label>Дата</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("justify-start text-left font-normal", !date && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date ? format(date, 'PPP', { locale: ru }) : 'Выберите дату'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={ru} />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="grid gap-2">
                            <Label>Время</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="time"
                                    min={date ? buildClinicSlots(date)[0] : undefined}
                                    max={date ? getClinicHours(date).end : undefined}
                                    step={1800}
                                    value={form.start_time}
                                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                                />
                                <Select value={form.duration} onValueChange={(v) => setForm({ ...form, duration: v })}>
                                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="30">30м</SelectItem>
                                        <SelectItem value="60">1ч</SelectItem>
                                        <SelectItem value="90">1.5ч</SelectItem>
                                        <SelectItem value="120">2ч</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <span className="text-xs text-slate-500">
                                {date && buildClinicSlots(date).length
                                    ? `Доступно: ${getClinicHours(date).start} - ${getClinicHours(date).end}`
                                    : 'В этот день клиника закрыта'}
                            </span>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Услуга / процедура</Label>
                        <Input placeholder="Например: чистка, лечение кариеса..." value={form.service_name} onChange={(e) => setForm({ ...form, service_name: e.target.value })} />
                    </div>

                    <div className="grid gap-2">
                        <Label>Жалоба / что болит</Label>
                        <Textarea placeholder="Опишите жалобу пациента..." value={form.complaint} onChange={(e) => setForm({ ...form, complaint: e.target.value })} rows={2} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label>План лечения</Label>
                            <Input placeholder="Что планируется делать..." value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Стоимость (MDL)</Label>
                            <Input type="number" placeholder="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
                    <Button onClick={handleSubmit} disabled={loading} className="bg-teal-600 hover:bg-teal-700">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Создать запись
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
