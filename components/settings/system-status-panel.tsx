'use client'

import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Database,
  PlugZap,
  Server,
  UsersRound,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  useAppointments,
  useGoogleCalendarEvents,
  useGoogleCalendarSources,
  useJivoConversations,
  useLeads,
  usePatients,
  useTasks,
} from '@/lib/hooks'

export function SystemStatusPanel() {
  const { patients } = usePatients()
  const { leads } = useLeads()
  const { appointments } = useAppointments()
  const { tasks } = useTasks()
  const { conversations } = useJivoConversations()
  const { sources } = useGoogleCalendarSources()
  const { googleEvents } = useGoogleCalendarEvents()
  const dbMode = process.env.NEXT_PUBLIC_DB_MODE === 'server' ? 'server' : 'local'
  const isServerMode = dbMode === 'server'

  const activeTasks = tasks.filter((task: any) => !['done', 'cancelled'].includes(task.status)).length
  const activeLeads = leads.filter((lead: any) => !['converted', 'rejected', 'lost'].includes(lead.status)).length
  const latestJivo = conversations[0]

  return (
    <Card className="crm-panel border-0 md:col-span-3">
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-teal-600" />
            Состояние системы
          </CardTitle>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Рабочие данные CRM хранятся на сервере. Здесь видно, подключена ли база, приходят ли обращения Jivo и есть ли синхронизация календарей.
          </p>
        </div>
        <Badge
          variant="outline"
          className={isServerMode
            ? 'w-fit rounded-full border-teal-200 bg-teal-50 px-3 py-1 text-teal-700'
            : 'w-fit rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-amber-700'
          }
        >
          {isServerMode ? 'VPS PostgreSQL' : 'локальный режим'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatusTile icon={Database} label="База данных" value={isServerMode ? 'Серверная' : 'Локальная'} hint={isServerMode ? 'PostgreSQL на VPS' : 'Только этот браузер'} tone="teal" />
          <StatusTile icon={UsersRound} label="Пациенты" value={patients.length} hint={`${activeLeads} активных заявок`} tone="sky" />
          <StatusTile icon={CalendarDays} label="Записи" value={appointments.length} hint={`${activeTasks} задач в работе`} tone="violet" />
          <StatusTile icon={PlugZap} label="Jivo" value={conversations.length} hint={latestJivo ? `Последний: ${latestJivo.client_name || 'клиент'}` : 'Ожидаем события'} tone="emerald" />
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <HealthLine
            icon={CheckCircle2}
            title="Хранение данных"
            text={isServerMode ? 'CRM работает через серверную PostgreSQL-базу. Данные доступны всем пользователям системы.' : 'Сейчас включен локальный режим. Для общей работы нужен NEXT_PUBLIC_DB_MODE=server.'}
            ok={isServerMode}
          />
          <HealthLine
            icon={Activity}
            title="Jivo webhook"
            text={conversations.length ? 'Диалоги уже приходят в CRM и участвуют в KPI менеджеров.' : 'Webhook URL готов. После события из Jivo здесь появятся диалоги.'}
            ok={conversations.length > 0}
          />
          <HealthLine
            icon={CalendarDays}
            title="Google Calendar"
            text={sources.length ? `${sources.length} календарей, ${googleEvents.length} импортированных событий.` : 'Календари пока не добавлены или не синхронизированы.'}
            ok={sources.length > 0}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function StatusTile({ icon: Icon, label, value, hint, tone }: { icon: any; label: string; value: string | number; hint: string; tone: 'teal' | 'sky' | 'violet' | 'emerald' }) {
  const tones = {
    teal: 'bg-teal-50 text-teal-700',
    sky: 'bg-sky-50 text-sky-700',
    violet: 'bg-violet-50 text-violet-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  }

  return (
    <div className="rounded-3xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
        </div>
        <div className={`rounded-2xl p-3 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-3 text-sm text-slate-500">{hint}</div>
    </div>
  )
}

function HealthLine({ icon: Icon, title, text, ok }: { icon: any; title: string; text: string; ok: boolean }) {
  return (
    <div className="rounded-3xl border bg-white p-4">
      <div className="mb-2 flex items-center gap-2 font-semibold text-slate-950">
        <Icon className={`h-4 w-4 ${ok ? 'text-teal-600' : 'text-amber-500'}`} />
        {title}
      </div>
      <p className="text-sm leading-6 text-slate-500">{text}</p>
    </div>
  )
}
