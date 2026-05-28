'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CalendarPlus,
  Camera,
  Clock3,
  CreditCard,
  Filter,
  Globe,
  Loader2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Send,
  UserPlus,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAppointments, useLeads, useTasks } from '@/lib/hooks'
import { db } from '@/lib/insforge'
import { AddLeadDialog } from './add-lead-dialog'
import { ConvertLeadDialog } from './convert-lead-dialog'
import { dateLabel, isOverdue, leadStatuses, sourceLabels } from '@/lib/crm'
import { paymentPreferences, scanTypeLabel } from '@/lib/patient-crm'
import { ensureLeadStatusAutomation, runLostLeadSweep } from '@/lib/manager-automation'

const sourceIcons: Record<string, any> = {
  phone: Phone,
  whatsapp: MessageCircle,
  instagram: MessageCircle,
  website: Globe,
  email: Mail,
  other: MoreHorizontal,
}

const funnelSegments = [
  { value: 'active', label: 'Активные' },
  { value: 'lost', label: 'Потерянные' },
  { value: 'all', label: 'Все' },
]

export function LeadsList() {
  const { leads, isLoading, mutate } = useLeads()
  const { mutate: mutateAppointments } = useAppointments()
  const { mutate: mutateTasks } = useTasks()
  const [segment, setSegment] = useState('active')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [statusDialog, setStatusDialog] = useState<{ open: boolean; lead: any; status: string; title: string }>({
    open: false,
    lead: null,
    status: '',
    title: '',
  })
  const [statusReason, setStatusReason] = useState('')

  useEffect(() => {
    let alive = true
    runLostLeadSweep(leads).then((changed) => {
      if (alive && changed > 0) {
        mutate()
        mutateTasks()
      }
    })
    return () => { alive = false }
  }, [leads, mutate, mutateTasks])

  const filtered = useMemo(() => leads.filter((lead: any) => {
    if (segment === 'active' && ['lost', 'rejected'].includes(lead.status)) return false
    if (segment === 'lost' && !['no_answer', 'lost', 'rejected'].includes(lead.status)) return false
    if (statusFilter !== 'all' && lead.status !== statusFilter) return false
    if (sourceFilter !== 'all' && lead.source !== sourceFilter) return false
    const haystack = `${lead.name || ''} ${lead.phone || ''} ${lead.email || ''} ${lead.interested_service || ''} ${lead.message || ''}`.toLowerCase()
    return haystack.includes(query.toLowerCase())
  }), [leads, segment, statusFilter, sourceFilter, query])

  const resetFilters = () => {
    setSegment('active')
    setStatusFilter('all')
    setSourceFilter('all')
    setQuery('')
  }

  const updateStatus = async (lead: any, status: string, reason = '') => {
    const patch: Record<string, any> = { status }
    if (status === 'contacted') {
      patch.contacted_at = new Date().toISOString()
      patch.lost_funnel_state = null
    }
    if (['scheduled', 'came', 'converted'].includes(status)) patch.lost_funnel_state = null
    await db.from('leads').update(patch).eq('id', lead.id)
    await ensureLeadStatusAutomation({ lead, status, reason })
    mutate()
    mutateTasks()
  }

  const returnToWork = async (lead: any) => {
    await db.from('leads').update({
      status: 'contacted',
      lost_funnel_state: 'returned',
      next_contact_at: new Date().toISOString(),
    }).eq('id', lead.id)
    await db.from('contact_history').insert([{
      patient_id: lead.converted_patient_id || lead.patient_id || null,
      lead_id: lead.id,
      type: 'note',
      direction: 'internal',
      summary: 'Потерянный клиент возвращен в работу менеджера.',
    }])
    mutate()
  }

  const openStatusDialog = (lead: any, status: string, title: string) => {
    setStatusDialog({ open: true, lead, status, title })
    setStatusReason('')
  }

  const confirmStatusChange = async () => {
    if (!statusDialog.lead || !statusDialog.status) return
    await updateStatus(statusDialog.lead, statusDialog.status, statusReason)
    setStatusDialog({ open: false, lead: null, status: '', title: '' })
    setStatusReason('')
  }

  const openConvert = (lead: any) => {
    setSelectedLead(lead)
    setConvertOpen(true)
  }

  const statKeys = ['new', 'contacted', 'thinking', 'no_answer', 'lost']

  return (
    <div className="space-y-6 animate-soft-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Заявки</h1>
          <p className="mt-1 max-w-3xl text-slate-500">
            Воронка обращений и система потерянных клиентов: контроль 3 дня, касания 7/14/30, возврат в работу и история контактов.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="h-11 rounded-2xl bg-gradient-to-r from-teal-500 to-sky-500 text-white hover:from-teal-600 hover:to-sky-600">
          <Plus className="mr-2 h-4 w-4" />
          Заявка
        </Button>
      </div>

      <Card className="crm-panel border-0">
        <CardContent className="space-y-4 p-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {funnelSegments.map((item) => (
              <Button
                key={item.value}
                variant={segment === item.value ? 'default' : 'outline'}
                onClick={() => setSegment(item.value)}
                className={`h-10 shrink-0 rounded-2xl ${segment === item.value ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-white'}`}
              >
                {item.label}
              </Button>
            ))}
          </div>

          {segment === 'lost' && (
            <div className="rounded-3xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="font-semibold">Система потерянных клиентов</div>
                  <p className="mt-1">
                    Если клиент не отвечает 3 дня, CRM переводит его сюда и запускает касания 7/14/30: повторный контакт, кейс лечения, акция или новый повод вернуться.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_160px_160px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск заявки, телефона, услуги..." className="h-11 rounded-2xl bg-white pl-9" />
            </div>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-11 rounded-2xl bg-white"><Globe className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все источники</SelectItem>
                {Object.entries(sourceLabels).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-11 rounded-2xl bg-white"><Filter className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                {Object.entries(leadStatuses).map(([key, status]) => <SelectItem key={key} value={key}>{status.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={resetFilters} className="h-11 rounded-2xl bg-white">
              <RotateCcw className="mr-2 h-4 w-4" />
              Сброс
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-5">
        {statKeys.map((statusKey) => {
          const status = leadStatuses[statusKey]
          return (
            <Card key={statusKey} className="crm-panel border-0">
              <CardContent className="flex items-center justify-between p-4">
                <span className="text-sm font-medium text-slate-500">{status.label}</span>
                <span className="text-2xl font-semibold">{leads.filter((lead: any) => lead.status === statusKey).length}</span>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="crm-panel border-0">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <UserPlus className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              Заявок по фильтрам нет.
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((lead: any) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  onStatus={updateStatus}
                  onOpenConvert={openConvert}
                  onReturnToWork={returnToWork}
                  onStatusDialog={openStatusDialog}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddLeadDialog open={dialogOpen} onOpenChange={setDialogOpen} onSuccess={() => { mutate(); setDialogOpen(false) }} />
      <ConvertLeadDialog
        lead={selectedLead}
        open={convertOpen}
        onOpenChange={setConvertOpen}
        onSuccess={() => { mutate(); mutateAppointments(); setConvertOpen(false) }}
      />
      <Dialog open={statusDialog.open} onOpenChange={(open) => setStatusDialog((current) => ({ ...current, open }))}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{statusDialog.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-3xl border bg-slate-50 p-4 text-sm text-slate-600">
              CRM создаст автоматические задачи менеджеру и добавит запись в историю пациента/заявки.
              {statusDialog.status === 'cancelled' && ' Через день появится задача перезвонить и выяснить причину отмены.'}
              {statusDialog.status === 'no_answer' && ' Через 3 дня CRM проверит отсутствие ответа и запустит потерянную воронку 7/14/30.'}
              {statusDialog.status === 'lost' && ' Будут созданы касания 7/14/30: повторный контакт, кейс лечения, акция или новый повод вернуться.'}
            </div>
            <div className="grid gap-2">
              <Label>Комментарий менеджера</Label>
              <Textarea
                value={statusReason}
                onChange={(event) => setStatusReason(event.target.value)}
                rows={4}
                placeholder="Что произошло, почему не отвечает/отказался, когда лучше вернуться..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialog({ open: false, lead: null, status: '', title: '' })}>Отмена</Button>
            <Button onClick={confirmStatusChange} className="bg-teal-600 hover:bg-teal-700">Сохранить и создать задачи</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LeadRow({ lead, onStatus, onOpenConvert, onReturnToWork, onStatusDialog }: any) {
  const status = leadStatuses[lead.status] || leadStatuses.new
  const SourceIcon = sourceIcons[lead.source] || MoreHorizontal
  const overdue = lead.next_contact_at && isOverdue(lead.next_contact_at) && !['scheduled', 'came', 'lost', 'converted', 'cancelled'].includes(lead.status)

  return (
    <div className={`p-4 transition hover:bg-white/70 ${overdue ? 'bg-rose-50/40' : ''}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <SourceIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-950">{lead.name}</h3>
              <Badge variant="outline" className={status.tone}>{status.label}</Badge>
              {lead.converted_patient_id && <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700">Пациент связан</Badge>}
              {lead.has_3d_scan && <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700"><Camera className="mr-1 h-3 w-3" />3D</Badge>}
              {lead.payment_preference && lead.payment_preference !== 'unknown' && (
                <Badge variant="outline" className={paymentPreferences[lead.payment_preference]?.tone || 'bg-slate-50'}>
                  <CreditCard className="mr-1 h-3 w-3" />
                  {paymentPreferences[lead.payment_preference]?.label || lead.payment_preference}
                </Badge>
              )}
              {overdue && <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">Просрочен контакт</Badge>}
              {lead.lost_funnel_state === 'waiting_3_days' && <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">контроль 3 дня</Badge>}
              {lead.lost_funnel_state === 'recovery_active' && <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">цепочка 7/14/30</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              {lead.phone && <span><Phone className="mr-1 inline h-3 w-3" />{lead.phone}</span>}
              {lead.email && <span><Mail className="mr-1 inline h-3 w-3" />{lead.email}</span>}
              <span>{sourceLabels[lead.source] || lead.source || 'Источник не указан'}</span>
              {lead.interested_service && <span>{lead.interested_service}</span>}
            </div>
            {lead.message && <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">{lead.message}</p>}
            {lead.has_3d_scan && (
              <div className="mt-3 flex flex-wrap gap-2 rounded-2xl bg-sky-50 p-3 text-sm text-sky-800">
                <span><Paperclip className="mr-1 inline h-3 w-3" />{scanTypeLabel(lead.scan_type)}</span>
                {lead.scan_file_name && <span>{lead.scan_file_name}</span>}
                {lead.scan_url && <span className="truncate">ссылка добавлена</span>}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-500">
              {lead.next_contact_at && <span><Clock3 className="mr-1 inline h-3 w-3" />Контакт: {dateLabel(lead.next_contact_at)}</span>}
              {lead.preferred_date && <span><CalendarPlus className="mr-1 inline h-3 w-3" />Хочет: {lead.preferred_date} {lead.preferred_time || ''}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          {!['contacted', 'scheduled', 'came', 'converted'].includes(lead.status) && (
            <Button size="sm" variant="outline" onClick={() => onStatus(lead, 'contacted')}>Связались</Button>
          )}
          {!['thinking', 'scheduled', 'came', 'lost', 'converted', 'cancelled'].includes(lead.status) && (
            <Button size="sm" variant="outline" onClick={() => onStatus(lead, 'thinking')}>Думает</Button>
          )}
          {!['scheduled', 'came', 'converted', 'cancelled'].includes(lead.status) && (
            <Button size="sm" onClick={() => onOpenConvert(lead)} className="bg-emerald-600 hover:bg-emerald-700">Создать запись</Button>
          )}
          {!['no_answer', 'lost', 'rejected', 'came', 'cancelled'].includes(lead.status) && (
            <Button size="sm" variant="outline" className="border-orange-200 text-orange-700 hover:bg-orange-50" onClick={() => onStatusDialog(lead, 'no_answer', 'Клиент не отвечает')}>
              Не отвечает
            </Button>
          )}
          {['no_answer', 'lost', 'rejected'].includes(lead.status) && (
            <Button size="sm" variant="outline" className="border-teal-200 text-teal-700 hover:bg-teal-50" onClick={() => onReturnToWork(lead)}>
              Вернуть в работу
            </Button>
          )}
          {lead.status === 'lost' && (
            <Button size="sm" variant="outline" onClick={() => onStatusDialog(lead, 'lost', 'Запустить касания 7/14/30')}>
              <Send className="mr-1 h-3 w-3" />
              7/14/30
            </Button>
          )}
          {!['cancelled', 'lost', 'rejected', 'came'].includes(lead.status) && (
            <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => onStatusDialog(lead, 'cancelled', 'Отмена заявки')}>Отменена</Button>
          )}
        </div>
      </div>
    </div>
  )
}
