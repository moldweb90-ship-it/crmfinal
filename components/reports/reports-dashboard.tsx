'use client'

import { BarChart3, CalendarCheck, CircleDollarSign, TrendingUp, UsersRound } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAppointments, useLeads, usePayments, useTreatmentPlans } from '@/lib/hooks'
import { money, sourceLabels, todayRange, isInRange } from '@/lib/crm'

export function ReportsDashboard() {
  const { leads } = useLeads()
  const { appointments } = useAppointments()
  const { plans } = useTreatmentPlans()
  const { payments } = usePayments()
  const today = todayRange()

  const bySource = (Object.entries(leads.reduce((acc: Record<string, number>, lead: any) => {
    acc[lead.source || 'other'] = (acc[lead.source || 'other'] || 0) + 1
    return acc
  }, {})) as Array<[string, number]>).sort((a, b) => b[1] - a[1])

  const converted = leads.filter((lead: any) => ['scheduled', 'came', 'converted'].includes(lead.status)).length
  const came = appointments.filter((appt: any) => appt.status === 'completed').length
  const todayPayments = payments
    .filter((payment: any) => isInRange(payment.paid_at || payment.created_at, today.start, today.end))
    .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0)
  const planTotal = plans.reduce((sum: number, plan: any) => sum + Number(plan.amount || 0), 0)
  const paymentTotal = payments.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0)

  const cards = [
    { label: 'Заявок всего', value: leads.length, icon: UsersRound },
    { label: 'Конверсия в запись', value: `${leads.length ? Math.round((converted / leads.length) * 100) : 0}%`, icon: TrendingUp },
    { label: 'Пришедшие пациенты', value: came, icon: CalendarCheck },
    { label: 'Оплаты сегодня', value: money(todayPayments), icon: CircleDollarSign },
  ]

  return (
    <div className="space-y-6 animate-soft-in">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Отчеты</h1>
        <p className="mt-1 text-slate-500">Короткая управленческая картина по заявкам, визитам и деньгам.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="crm-panel border-0">
            <CardContent className="flex items-start justify-between p-5">
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <div className="mt-3 text-3xl font-semibold text-slate-950">{card.value}</div>
              </div>
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700"><card.icon className="h-5 w-5" /></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="crm-panel border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Заявки по источникам</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {bySource.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">Пока нет заявок.</div>
            ) : bySource.map(([source, count]) => {
              const percent = leads.length ? Math.round((count / leads.length) * 100) : 0
              return (
                <div key={source} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{sourceLabels[source] || source}</span>
                    <span className="text-slate-500">{count} · {percent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-slate-950 transition-all" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="crm-panel border-0">
          <CardHeader>
            <CardTitle>Финансы и планы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReportRow label="Сумма планов лечения" value={money(planTotal)} />
            <ReportRow label="Сумма оплат" value={money(paymentTotal)} />
            <ReportRow label="Остаток потенциала" value={money(Math.max(0, planTotal - paymentTotal))} />
            <div className="rounded-3xl bg-slate-950 p-5 text-white">
              <div className="text-sm text-slate-300">Закрытие планов оплатами</div>
              <div className="mt-2 text-4xl font-semibold">{planTotal ? Math.round((paymentTotal / planTotal) * 100) : 0}%</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="crm-panel border-0">
        <CardHeader><CardTitle>Статусы заявок</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {['new', 'contacted', 'thinking', 'scheduled', 'came', 'not_came', 'no_answer', 'cancelled', 'lost', 'converted', 'rejected'].map((status) => {
            const count = leads.filter((lead: any) => lead.status === status).length
            if (!count) return null
            return <Badge key={status} variant="outline" className="rounded-xl px-3 py-1">{status}: {count}</Badge>
          })}
        </CardContent>
      </Card>
    </div>
  )
}

function ReportRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border bg-white p-4">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-950">{value}</span>
    </div>
  )
}
