'use client'

import { useState } from 'react'
import { CalendarDays, CheckCircle2, Copy, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useClinics, useDoctors, useGoogleCalendarEvents, useGoogleCalendarSources } from '@/lib/hooks'
import { db } from '@/lib/insforge'
import { buildDemoGoogleEvent, googleSyncModes } from '@/lib/google-calendar'

const colors = ['#4285f4', '#34a853', '#fbbc04', '#ea4335', '#14b8a6', '#8b5cf6']

export function GoogleCalendarPanel() {
  const { sources, mutate: mutateSources } = useGoogleCalendarSources()
  const { googleEvents, mutate: mutateEvents } = useGoogleCalendarEvents()
  const { doctors } = useDoctors()
  const { clinics } = useClinics()
  const [form, setForm] = useState({
    name: '',
    calendar_id: '',
    ical_url: '',
    doctor_id: '',
    clinic_id: '',
    color_code: colors[0],
    sync_mode: 'read_only',
  })
  const [syncingId, setSyncingId] = useState<string | null>(null)

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/google-calendar/sync`
    : '/api/google-calendar/sync'

  const addSource = async () => {
    if (!form.name.trim()) return
    await db.from('google_calendar_sources').insert([{
      ...form,
      calendar_id: form.calendar_id || form.ical_url || form.name,
      doctor_id: form.doctor_id || null,
      clinic_id: form.clinic_id || null,
      is_active: true,
      last_synced_at: null,
      sync_token: null,
    }])
    setForm({
      name: '',
      calendar_id: '',
      ical_url: '',
      doctor_id: '',
      clinic_id: '',
      color_code: colors[0],
      sync_mode: 'read_only',
    })
    mutateSources()
  }

  const demoSync = async (source: any) => {
    await db.from('google_calendar_events').insert([buildDemoGoogleEvent(source)])
    await db.from('google_calendar_sources').update({ last_synced_at: new Date().toISOString() }).eq('id', source.id)
    mutateEvents()
    mutateSources()
  }

  const importIcs = async (source: any) => {
    if (!source.ical_url) {
      alert('Сначала вставьте Secret iCal URL в настройках календаря.')
      return
    }
    setSyncingId(source.id)
    try {
      const response = await fetch('/api/google-calendar/ics-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: source.ical_url }),
      })
      const result = await response.json()
      if (!response.ok || result.result !== 'ok') throw new Error(result.message || 'Ошибка импорта')

      const existingKeys = new Set(
        googleEvents
          .filter((event: any) => event.calendar_id === source.calendar_id)
          .map((event: any) => event.google_event_id)
      )
      const rows = result.events
        .filter((event: any) => !existingKeys.has(event.google_event_id))
        .map((event: any) => ({
          ...event,
          source_id: source.id,
          calendar_id: source.calendar_id,
          doctor_id: source.doctor_id || null,
          clinic_id: source.clinic_id || null,
          last_seen_at: new Date().toISOString(),
        }))

      if (rows.length) await db.from('google_calendar_events').insert(rows)
      await db.from('google_calendar_sources').update({ last_synced_at: new Date().toISOString() }).eq('id', source.id)
      mutateEvents()
      mutateSources()
      alert(`Импортировано новых событий: ${rows.length}. Всего найдено в календаре: ${result.count}.`)
    } catch (error: any) {
      alert(error?.message || 'Не удалось импортировать ICS')
    } finally {
      setSyncingId(null)
    }
  }

  const copyEndpoint = async () => {
    await navigator.clipboard?.writeText(webhookUrl)
  }

  return (
    <Card id="google-calendar" className="crm-panel border-0 md:col-span-3">
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-sky-600" />
            Google Calendar
          </CardTitle>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Подключайте отдельные календари врачей или филиалов. Менеджер будет видеть пациентов из Google прямо в расписании CRM.
          </p>
        </div>
        <Badge variant="outline" className="w-fit rounded-full border-sky-200 bg-sky-50 px-3 py-1 text-sky-700">
          Read-only синхронизация
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
          <div className="rounded-3xl border bg-white p-4">
            <div className="mb-4 font-semibold text-slate-950">Добавить календарь</div>
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>Название</Label>
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ботаника / Чеканы / Д-р Руслан" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Врач</Label>
                  <Select value={form.doctor_id || 'none'} onValueChange={(doctor_id) => setForm({ ...form, doctor_id: doctor_id === 'none' ? '' : doctor_id })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Без врача</SelectItem>
                      {doctors.map((doctor: any) => <SelectItem key={doctor.id} value={doctor.id}>{doctor.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Филиал</Label>
                  <Select value={form.clinic_id || 'none'} onValueChange={(clinic_id) => setForm({ ...form, clinic_id: clinic_id === 'none' ? '' : clinic_id })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Без филиала</SelectItem>
                      {clinics.map((clinic: any) => <SelectItem key={clinic.id} value={clinic.id}>{clinic.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Calendar ID или email календаря</Label>
                <Input value={form.calendar_id} onChange={(event) => setForm({ ...form, calendar_id: event.target.value })} placeholder="example@gmail.com или ...@group.calendar.google.com" />
              </div>
              <div className="grid gap-2">
                <Label>Secret iCal URL для быстрого read-only импорта</Label>
                <Input value={form.ical_url} onChange={(event) => setForm({ ...form, ical_url: event.target.value })} placeholder="https://calendar.google.com/calendar/ical/.../basic.ics" />
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_160px]">
                <Select value={form.sync_mode} onValueChange={(sync_mode) => setForm({ ...form, sync_mode })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(googleSyncModes).map(([key, mode]) => <SelectItem key={key} value={key}>{mode.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={form.color_code} onValueChange={(color_code) => setForm({ ...form, color_code })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {colors.map((color) => <SelectItem key={color} value={color}><span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />{color}</span></SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addSource} className="rounded-2xl bg-sky-600 hover:bg-sky-700">
                <CalendarDays className="mr-2 h-4 w-4" />
                Добавить календарь
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-3xl border bg-white p-4">
              <div className="mb-2 flex items-center gap-2 font-semibold text-slate-950">
                <ShieldCheck className="h-4 w-4 text-sky-600" />
                Как будет работать на домене
              </div>
              <p className="text-sm text-slate-500">
                Для полноценной синхронизации нужен Google OAuth, refresh token и серверная база.
                Google Calendar API умеет отдавать события календаря и поддерживает incremental sync через syncToken.
              </p>
              <div className="mt-3 rounded-2xl bg-slate-50 p-3 font-mono text-xs text-slate-600">{webhookUrl}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" onClick={copyEndpoint} className="rounded-2xl bg-white">
                  <Copy className="mr-2 h-4 w-4" />
                  Скопировать endpoint
                </Button>
                <Button asChild variant="outline" className="rounded-2xl bg-white">
                  <a href="https://developers.google.com/calendar/api/v3/reference/events/list" target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    API events
                  </a>
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Mini label="Календарей" value={sources.length} />
              <Mini label="Событий" value={googleEvents.length} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {sources.map((source: any) => {
            const doctor = doctors.find((item: any) => item.id === source.doctor_id)
            const clinic = clinics.find((item: any) => item.id === source.clinic_id)
            const count = googleEvents.filter((event: any) => event.source_id === source.id).length
            return (
              <div key={source.id} className="rounded-3xl border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: source.color_code || '#4285f4' }} />
                      <div className="truncate font-semibold text-slate-950">{source.name}</div>
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-slate-500">
                      <div>{doctor?.full_name || 'Врач не выбран'}</div>
                      <div>{clinic?.name || 'Филиал не выбран'}</div>
                      <div className="truncate">{source.calendar_id}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-white">{count} событий</Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => demoSync(source)} className="rounded-xl">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Тест sync
                  </Button>
                  <Button size="sm" onClick={() => importIcs(source)} disabled={syncingId === source.id} className="rounded-xl bg-sky-600 hover:bg-sky-700">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {syncingId === source.id ? 'Импорт...' : 'Импорт ICS'}
                  </Button>
                  {source.last_synced_at && (
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      синхронизирован
                    </Badge>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl border bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  )
}
