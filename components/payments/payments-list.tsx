'use client'

import { useState } from 'react'
import { CreditCard, Loader2, Plus, ReceiptText, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePatients, usePayments, useTreatmentPlans } from '@/lib/hooks'
import { db } from '@/lib/insforge'
import { dateLabel, money } from '@/lib/crm'

const methodLabels: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта',
  transfer: 'Перевод',
  insurance: 'Страховка',
  other: 'Другое',
}

export function PaymentsList() {
  const { payments, isLoading, mutate } = usePayments()
  const { patients } = usePatients()
  const { plans } = useTreatmentPlans()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    patient_id: '',
    treatment_plan_id: 'none',
    amount: '',
    method: 'cash',
    paid_at: '',
    comment: '',
  })

  const patientById = (id: string) => patients.find((patient: any) => patient.id === id)
  const filtered = payments.filter((payment: any) => {
    const patient = patientById(payment.patient_id)
    return `${patient?.full_name || ''} ${payment.comment || ''}`.toLowerCase().includes(query.toLowerCase())
  })
  const total = filtered.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0)

  const savePayment = async () => {
    if (!form.patient_id || !form.amount) return
    setSaving(true)
    try {
      await db.from('payments').insert([{
        patient_id: form.patient_id,
        treatment_plan_id: form.treatment_plan_id === 'none' ? null : form.treatment_plan_id,
        amount: Number(form.amount),
        method: form.method,
        paid_at: form.paid_at ? new Date(form.paid_at).toISOString() : new Date().toISOString(),
        comment: form.comment || null,
      }])
      const patient = patientById(form.patient_id)
      if (patient) {
        await db.from('patients').update({
          total_spent: Number(patient.total_spent || 0) + Number(form.amount),
          debt: Math.max(0, Number(patient.debt || 0) - Number(form.amount)),
        }).eq('id', form.patient_id)
      }
      setForm({ patient_id: '', treatment_plan_id: 'none', amount: '', method: 'cash', paid_at: '', comment: '' })
      setOpen(false)
      mutate()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 animate-soft-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Оплаты</h1>
          <p className="mt-1 text-slate-500">Деньги по пациентам, планам лечения и визитам.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Пациент или комментарий" className="h-11 w-64 rounded-2xl bg-white pl-9" />
          </div>
          <Button onClick={() => setOpen(true)} className="h-11 rounded-2xl bg-slate-950 hover:bg-slate-800">
            <Plus className="mr-2 h-4 w-4" />
            Оплата
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="crm-panel border-0"><CardContent className="p-5"><p className="text-sm text-slate-500">Всего в списке</p><div className="mt-2 text-3xl font-semibold">{money(total)}</div></CardContent></Card>
        <Card className="crm-panel border-0"><CardContent className="p-5"><p className="text-sm text-slate-500">Платежей</p><div className="mt-2 text-3xl font-semibold">{filtered.length}</div></CardContent></Card>
        <Card className="crm-panel border-0"><CardContent className="p-5"><p className="text-sm text-slate-500">Средний платеж</p><div className="mt-2 text-3xl font-semibold">{money(filtered.length ? total / filtered.length : 0)}</div></CardContent></Card>
      </div>

      <Card className="crm-panel border-0">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500">Оплат пока нет.</div>
          ) : (
            <div className="divide-y">
              {filtered.map((payment: any) => {
                const patient = patientById(payment.patient_id)
                return (
                  <div key={payment.id} className="flex flex-col gap-3 p-4 transition hover:bg-white/70 md:flex-row md:items-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                      <ReceiptText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-950">{patient?.full_name || 'Пациент не указан'}</div>
                      <div className="text-sm text-slate-500">{payment.comment || dateLabel(payment.paid_at || payment.created_at)}</div>
                    </div>
                    <Badge variant="outline" className="bg-slate-50">{methodLabels[payment.method] || payment.method}</Badge>
                    <div className="text-xl font-semibold text-slate-950">{money(payment.amount)}</div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader><DialogTitle>Новая оплата</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Пациент</Label>
              <Select value={form.patient_id} onValueChange={(patient_id) => setForm({ ...form, patient_id })}>
                <SelectTrigger><SelectValue placeholder="Выберите пациента" /></SelectTrigger>
                <SelectContent>{patients.map((patient: any) => <SelectItem key={patient.id} value={patient.id}>{patient.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Сумма</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
              </div>
              <div className="grid gap-2">
                <Label>Метод</Label>
                <Select value={form.method} onValueChange={(method) => setForm({ ...form, method })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Наличные</SelectItem>
                    <SelectItem value="card">Карта</SelectItem>
                    <SelectItem value="transfer">Перевод</SelectItem>
                    <SelectItem value="insurance">Страховка</SelectItem>
                    <SelectItem value="other">Другое</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>План лечения</Label>
              <Select value={form.treatment_plan_id} onValueChange={(treatment_plan_id) => setForm({ ...form, treatment_plan_id })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без плана</SelectItem>
                  {plans.filter((plan: any) => !form.patient_id || plan.patient_id === form.patient_id).map((plan: any) => (
                    <SelectItem key={plan.id} value={plan.id}>{plan.title} - {money(plan.amount)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Дата</Label>
              <Input type="datetime-local" value={form.paid_at} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Комментарий</Label>
              <Textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={savePayment} disabled={saving} className="bg-slate-950 hover:bg-slate-800">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
