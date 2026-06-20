'use client'

import { useMemo, useState } from 'react'
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Clock3,
  Headphones,
  MessageCircle,
  PhoneCall,
  PlugZap,
  Target,
  TrendingUp,
  UserCheck,
  UsersRound,
  Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AreaTrendChart, DonutChart, RadialScore, SoftBarChart } from '@/components/dashboard/charts'
import {
  buildManagerKpi,
  formatSeconds,
  jivoChannelColors,
  jivoChannelLabels,
  kpiScore,
  type KpiRange,
} from '@/lib/manager-kpi'
import {
  useAppointments,
  useJivoConversations,
  useLeads,
  useManagerKpiTargets,
  useManagers,
  usePayments,
} from '@/lib/hooks'
import { money } from '@/lib/crm'

const rangeLabels: Record<KpiRange, string> = {
  today: 'Сегодня',
  yesterday: 'Вчера',
  week: '7 дней',
  month: '30 дней',
}

export function ManagerKpiDashboard() {
  const [range, setRange] = useState<KpiRange>('today')
  const { managers } = useManagers()
  const { conversations } = useJivoConversations()
  const { targets } = useManagerKpiTargets()
  const { leads } = useLeads()
  const { appointments } = useAppointments()
  const { payments } = usePayments()

  const kpi = useMemo(() => buildManagerKpi({
    range,
    managers,
    conversations,
    leads,
    appointments,
    payments,
  }), [range, managers, conversations, leads, appointments, payments])

  const primaryRow = kpi.rows[0]
  const primaryTarget = targets.find((target: any) => target.manager_id === primaryRow?.managerId) || targets[0]
  const score = primaryRow ? kpiScore(primaryRow, primaryTarget) : 0

  const channelSegments = kpi.byChannel.length
    ? kpi.byChannel
    : [{ label: 'Нет данных', value: 1, color: '#e2e8f0' }]

  const bars = [
    { label: 'Заявки', value: kpi.totals.newLeads },
    { label: 'Чаты', value: kpi.totals.conversations },
    { label: 'Звонки', value: kpi.totals.calls },
    { label: 'Записи', value: kpi.totals.appointments },
    { label: 'Продажи', value: kpi.totals.closedSales },
  ]
  const handled = Math.max(0, kpi.totals.conversations - kpi.totals.missed)
  const handledPercent = kpi.totals.conversations ? Math.round((handled / kpi.totals.conversations) * 100) : 0
  const missedPercent = kpi.totals.conversations ? Math.round((kpi.totals.missed / kpi.totals.conversations) * 100) : 0

  return (
    <div className="space-y-6 animate-soft-in">
      <div className="overflow-hidden rounded-[2rem] border border-teal-100 bg-gradient-to-br from-white via-cyan-50 to-teal-50 p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-4 rounded-full border-teal-200 bg-white px-3 py-1 text-teal-700">
              <Activity className="mr-1.5 h-3.5 w-3.5" />
              Контроль менеджеров и Jivo
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">KPI менеджера</h1>
            <p className="mt-2 text-slate-600">
              Автоматическая статистика по обращениям, скорости ответа, звонкам, консультациям, записям, продажам и конверсии.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={range} onValueChange={(value) => setRange(value as KpiRange)}>
              <SelectTrigger className="h-11 w-[150px] rounded-2xl bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(rangeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild className="h-11 rounded-2xl bg-gradient-to-r from-teal-500 to-sky-500 text-white">
              <a href="/settings#jivo">
                <PlugZap className="mr-2 h-4 w-4" />
                Подключить Jivo
              </a>
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={UsersRound} label="Новые заявки" value={kpi.totals.newLeads} hint="CRM + Jivo" />
          <KpiCard icon={Clock3} label="Скорость ответа" value={formatSeconds(kpi.totals.avgResponseSeconds)} hint="среднее время" tone="teal" />
          <KpiCard icon={UserCheck} label="Записи" value={kpi.totals.appointments} hint={`${kpi.totals.conversion}% конверсия`} tone="sky" />
          <KpiCard icon={Wallet} label="Сумма продаж" value={money(kpi.totals.salesAmount)} hint={`${kpi.totals.closedSales} закрыто`} tone="emerald" />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <OwnerControlCard
          icon={BadgeCheck}
          label="Обработано обращений"
          value={`${handled}/${kpi.totals.conversations}`}
          hint={`${handledPercent}% диалогов не пропущены`}
          tone="emerald"
        />
        <OwnerControlCard
          icon={MessageCircle}
          label="Пропущено Jivo"
          value={kpi.totals.missed}
          hint={kpi.totals.missed ? `${missedPercent}% нужно разобрать` : 'пропусков нет'}
          tone={kpi.totals.missed ? 'rose' : 'teal'}
        />
        <OwnerControlCard
          icon={Clock3}
          label="Средний ответ"
          value={formatSeconds(kpi.totals.avgResponseSeconds)}
          hint="как быстро менеджер берет чат"
          tone="sky"
        />
        <OwnerControlCard
          icon={TrendingUp}
          label="Довели до записи"
          value={`${kpi.totals.appointments}`}
          hint={`${kpi.totals.conversion}% от заявок и чатов`}
          tone="teal"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="crm-panel border-0">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-teal-600" />
                Динамика обращений
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500">Сколько диалогов пришло из подключенных каналов.</p>
            </div>
            <Badge variant="outline" className="w-fit bg-white">{rangeLabels[range]}</Badge>
          </CardHeader>
          <CardContent>
            <AreaTrendChart data={kpi.trend} />
          </CardContent>
        </Card>

        <Card className="crm-panel border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-teal-600" />
              Выполнение KPI
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <RadialScore value={score} label="план" />
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                Оценка собирается из заявок, звонков, консультаций, записей, продаж, суммы и скорости ответа.
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <MiniStat label="Звонки" value={kpi.totals.calls} />
                <MiniStat label="Консультации" value={kpi.totals.consultations} />
                <MiniStat label="Клиенты" value={kpi.totals.clients} />
                <MiniStat label="Пропущено" value={kpi.totals.missed} danger />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="crm-panel border-0">
          <CardHeader>
            <CardTitle>Каналы Jivo</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart segments={channelSegments} centerLabel="диалогов" centerValue={kpi.totals.conversations} />
          </CardContent>
        </Card>

        <Card className="crm-panel border-0">
          <CardHeader>
            <CardTitle>Воронка обработки</CardTitle>
          </CardHeader>
          <CardContent>
            <SoftBarChart data={bars} />
          </CardContent>
        </Card>
      </div>

      <Card className="crm-panel border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5 text-teal-600" />
            Менеджеры
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b bg-slate-50/70 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Менеджер</th>
                  <th className="px-4 py-3">KPI</th>
                  <th className="px-4 py-3">Заявки</th>
                  <th className="px-4 py-3">Ответ</th>
                  <th className="px-4 py-3">Звонки</th>
                  <th className="px-4 py-3">Консультации</th>
                  <th className="px-4 py-3">Записи</th>
                  <th className="px-4 py-3">Продажи</th>
                  <th className="px-4 py-3">Сумма</th>
                  <th className="px-4 py-3">Конверсия</th>
                </tr>
              </thead>
              <tbody>
                {kpi.rows.map((row) => {
                  const target = targets.find((item: any) => item.manager_id === row.managerId) || targets[0]
                  const rowScore = kpiScore(row, target)

                  return (
                    <tr key={row.managerId} className="border-b last:border-0">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-sky-500 font-semibold text-white">
                            {row.managerName.slice(0, 1)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-950">{row.managerName}</div>
                            <div className="text-xs text-slate-500">{row.conversations} диалогов, {row.clients} клиентов</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="outline" className={rowScore >= 80 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : rowScore >= 50 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-rose-200 bg-rose-50 text-rose-700'}>
                          {rowScore}%
                        </Badge>
                      </td>
                      <td className="px-4 py-4 font-medium">{row.newLeads}</td>
                      <td className="px-4 py-4">{formatSeconds(row.avgResponseSeconds)}</td>
                      <td className="px-4 py-4">{row.calls}</td>
                      <td className="px-4 py-4">{row.consultations}</td>
                      <td className="px-4 py-4">{row.appointments}</td>
                      <td className="px-4 py-4">{row.closedSales}</td>
                      <td className="px-4 py-4 font-semibold">{money(row.salesAmount)}</td>
                      <td className="px-4 py-4">{row.conversion}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="crm-panel border-0">
        <CardHeader>
          <CardTitle>Последние диалоги Jivo</CardTitle>
          <p className="text-sm text-slate-500">
            Здесь виден клиент, канал, ответственный менеджер и качество обработки. Один реальный чат считается один раз.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {kpi.rangedConversations.slice(0, 6).map((item: any) => (
            <div key={item.id} className="rounded-3xl border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950">{item.client_name || 'Клиент без имени'}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span>{item.client_phone || 'нет телефона'}</span>
                    <span>•</span>
                    <span>{item.manager_name || 'Менеджер'}</span>
                  </div>
                </div>
                <Badge variant="outline" style={{ borderColor: jivoChannelColors[item.channel] || '#cbd5e1', color: jivoChannelColors[item.channel] || '#475569' }}>
                  {jivoChannelLabels[item.channel] || item.channel || 'Канал'}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <MiniStat label="Ответ" value={formatSeconds(item.response_seconds)} />
                <MiniStat label="Сообщения" value={item.messages_count || 0} />
                <MiniStat label="Продажа" value={item.sale_closed ? 'Да' : 'Нет'} />
              </div>
            </div>
          ))}
          {kpi.rangedConversations.length === 0 && (
            <div className="rounded-3xl border border-dashed p-8 text-center text-sm text-slate-500 lg:col-span-2">
              Диалогов за выбранный период пока нет. После подключения Jivo они будут попадать сюда автоматически.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function OwnerControlCard({ icon: Icon, label, value, hint, tone = 'teal' }: any) {
  const tones: Record<string, string> = {
    teal: 'bg-teal-50 text-teal-700',
    sky: 'bg-sky-50 text-sky-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
  }

  return (
    <Card className="crm-panel border-0">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div>
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-semibold leading-none text-slate-950">{value}</div>
          <div className="mt-2 text-xs text-slate-500">{hint}</div>
        </div>
        <div className={`rounded-2xl p-3 ${tones[tone] || tones.teal}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function KpiCard({ icon: Icon, label, value, hint, tone = 'slate' }: any) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    teal: 'bg-teal-50 text-teal-700',
    sky: 'bg-sky-50 text-sky-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  }

  return (
    <Card className="border-white/80 bg-white/90 shadow-sm">
      <CardContent className="flex items-start justify-between p-4">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
          <p className="mt-1 text-xs text-slate-400">{hint}</p>
        </div>
        <div className={`rounded-2xl p-3 ${tones[tone] || tones.slate}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function MiniStat({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className="rounded-2xl border bg-white px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={danger ? 'font-semibold text-rose-600' : 'font-semibold text-slate-950'}>{value}</div>
    </div>
  )
}
