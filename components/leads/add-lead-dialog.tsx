'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Camera, CreditCard, FileArchive, Loader2, Paperclip, UserRound } from 'lucide-react'
import { db } from '@/lib/insforge'
import { usePatients } from '@/lib/hooks'
import { patientSources, paymentPreferences, scanTypes } from '@/lib/patient-crm'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const initialForm = {
  name: '',
  phone: '',
  email: '',
  source: 'phone',
  interested_service: '',
  message: '',
  next_contact_at: '',
  preferred_date: '',
  preferred_time: '',
  has_3d_scan: false,
  scan_type: 'dicom_zip',
  scan_url: '',
  scan_file_name: '',
  scan_file_mime: '',
  scan_file_data: '',
  payment_preference: 'unknown',
  credit_months: '12',
}

const scanAccept = '.dcm,.dicom,.zip,.pdf,.jpg,.jpeg,.png,.stl,.ply,.obj'

export function AddLeadDialog({ open, onOpenChange, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const { patients, mutate: mutatePatients } = usePatients()
  const [form, setForm] = useState(initialForm)

  const handleFile = (file?: File) => {
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      alert('Файл слишком большой для локальной CRM. Пока до 8 MB; большие DICOM лучше добавлять ZIP-ссылкой.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setForm((current) => ({
        ...current,
        scan_file_name: file.name,
        scan_file_mime: file.type || 'application/octet-stream',
        scan_file_data: String(reader.result || ''),
      }))
    }
    reader.readAsDataURL(file)
  }

  const findExistingPatient = () => {
    const phone = form.phone.replace(/\D/g, '')
    const email = form.email.trim().toLowerCase()
    return patients.find((patient: any) => {
      const patientPhone = String(patient.phone || '').replace(/\D/g, '')
      const patientEmail = String(patient.email || '').trim().toLowerCase()
      return (phone && patientPhone && patientPhone === phone) || (email && patientEmail && patientEmail === email)
    })
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) return
    setLoading(true)
    try {
      const existingPatient = findExistingPatient()
      let patientId = existingPatient?.id || null
      const patientPayload = {
        full_name: form.name.trim(),
        phone: form.phone || null,
        email: form.email || null,
        source: form.source,
        notes: form.message || null,
        manager_notes: form.next_contact_at ? 'Создано из заявки. Требуется следующий контакт.' : 'Создано из заявки.',
        next_follow_up_at: form.next_contact_at ? new Date(form.next_contact_at).toISOString() : null,
        status: form.next_contact_at ? 'needs_follow_up' : 'active',
        payment_preference: form.payment_preference,
        credit_months: form.payment_preference === 'credit' ? Number(form.credit_months || 0) : null,
        has_3d_scan: form.has_3d_scan,
        scan_type: form.has_3d_scan ? form.scan_type : null,
        scan_url: form.has_3d_scan ? form.scan_url || null : null,
        scan_file_name: form.has_3d_scan ? form.scan_file_name || null : null,
        scan_file_mime: form.has_3d_scan ? form.scan_file_mime || null : null,
        scan_file_data: form.has_3d_scan ? form.scan_file_data || null : null,
        total_spent: existingPatient?.total_spent || 0,
        debt: existingPatient?.debt || 0,
      }

      if (patientId) {
        await db.from('patients').update({
          ...patientPayload,
          full_name: existingPatient.full_name || patientPayload.full_name,
        }).eq('id', patientId)
      } else {
        const patientResult = await db.from('patients').insert([patientPayload]).select()
        patientId = patientResult.data?.[0]?.id || null
      }

      const leadResult = await db.from('leads').insert([{
        name: form.name.trim(),
        phone: form.phone || null,
        email: form.email || null,
        source: form.source,
        interested_service: form.interested_service || null,
        message: form.message || null,
        next_contact_at: form.next_contact_at ? new Date(form.next_contact_at).toISOString() : null,
        preferred_date: form.preferred_date || null,
        preferred_time: form.preferred_time || null,
        has_3d_scan: form.has_3d_scan,
        scan_type: form.has_3d_scan ? form.scan_type : null,
        scan_url: form.has_3d_scan ? form.scan_url || null : null,
        scan_file_name: form.has_3d_scan ? form.scan_file_name || null : null,
        scan_file_mime: form.has_3d_scan ? form.scan_file_mime || null : null,
        scan_file_data: form.has_3d_scan ? form.scan_file_data || null : null,
        payment_preference: form.payment_preference,
        credit_months: form.payment_preference === 'credit' ? Number(form.credit_months || 0) : null,
        converted_patient_id: patientId,
        status: 'new',
      }]).select()

      if (patientId) {
        await db.from('contact_history').insert([{
          patient_id: patientId,
          lead_id: leadResult.data?.[0]?.id || null,
          type: 'note',
          direction: 'incoming',
          summary: `Заявка создана. Оплата: ${paymentPreferences[form.payment_preference]?.label || 'не уточнено'}${form.has_3d_scan ? '. Есть 3D-снимок.' : '.'}`,
        }])
      }

      await mutatePatients()
      setForm(initialForm)
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>Новая заявка</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5 py-2">
          <div className="rounded-3xl border bg-gradient-to-br from-cyan-50 to-white p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold text-slate-950"><UserRound className="h-5 w-5 text-teal-600" />Контакт и интерес</div>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Имя клиента *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Мария Попеску" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Телефон</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+373..." />
                </div>
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@..." />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Источник</Label>
                  <Select value={form.source} onValueChange={(source) => setForm({ ...form, source })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{patientSources.map((source) => <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Интересующая услуга</Label>
                  <Input value={form.interested_service} onChange={(e) => setForm({ ...form, interested_service: e.target.value })} placeholder="Имплантация, чистка, брекеты..." />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label>Следующий контакт</Label>
              <Input type="datetime-local" value={form.next_contact_at} onChange={(e) => setForm({ ...form, next_contact_at: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Желаемая дата</Label>
              <Input type="date" value={form.preferred_date} onChange={(e) => setForm({ ...form, preferred_date: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Время</Label>
              <Input type="time" value={form.preferred_time} onChange={(e) => setForm({ ...form, preferred_time: e.target.value })} />
            </div>
          </div>

          <div className="rounded-3xl border bg-white p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold text-slate-950"><Camera className="h-5 w-5 text-sky-600" />3D-снимок / диагностика</div>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition hover:bg-cyan-50/60">
              <Checkbox
                checked={form.has_3d_scan}
                onCheckedChange={(checked) => setForm({ ...form, has_3d_scan: Boolean(checked) })}
                className="mt-1 h-5 w-5 rounded-lg border-teal-500 data-[state=checked]:bg-teal-500"
              />
              <span>
                <span className="block font-medium text-slate-950">У пациента уже есть 3D-снимок</span>
                <span className="text-sm text-slate-500">Если включено, менеджер прикладывает файл или ссылку. Если нет, лишние поля скрыты.</span>
              </span>
            </label>

            {form.has_3d_scan && (
              <div className="mt-4 grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Тип материала</Label>
                    <Select value={form.scan_type} onValueChange={(scan_type) => setForm({ ...form, scan_type })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{scanTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Файл снимка</Label>
                    <Input type="file" accept={scanAccept} onChange={(event) => handleFile(event.target.files?.[0])} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Ссылка на снимок / облако</Label>
                  <Input value={form.scan_url} onChange={(e) => setForm({ ...form, scan_url: e.target.value })} placeholder="https://drive..., ссылка из томографии..." />
                </div>
                {form.scan_file_name && (
                  <Badge variant="outline" className="w-fit border-teal-200 bg-teal-50 text-teal-700">
                    <Paperclip className="mr-1 h-3 w-3" />
                    {form.scan_file_name}
                  </Badge>
                )}
                <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">
                  Поддерживаемые форматы: DICOM/DICOM ZIP, PDF, JPG/PNG, STL/PLY/OBJ. Большие архивы лучше прикреплять ссылкой.
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border bg-white p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold text-slate-950"><CreditCard className="h-5 w-5 text-amber-600" />Предпочтение оплаты</div>
            <div className="grid gap-4 md:grid-cols-[1fr_180px]">
              <Select value={form.payment_preference} onValueChange={(payment_preference) => setForm({ ...form, payment_preference })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(paymentPreferences).map(([key, payment]) => <SelectItem key={key} value={key}>{payment.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.payment_preference === 'credit' && (
                <Select value={form.credit_months} onValueChange={(credit_months) => setForm({ ...form, credit_months })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 месяца</SelectItem>
                    <SelectItem value="6">6 месяцев</SelectItem>
                    <SelectItem value="12">12 месяцев</SelectItem>
                    <SelectItem value="24">24 месяца</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Комментарий / жалоба</Label>
            <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} placeholder="Что беспокоит, что хочет узнать, важный контекст" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-teal-600 hover:bg-teal-700">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Создать заявку
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
