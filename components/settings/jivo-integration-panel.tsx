'use client'

import { Copy, ExternalLink, PlugZap, ShieldCheck, Webhook } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useJivoConversations, useJivoEvents } from '@/lib/hooks'

export function JivoIntegrationPanel() {
  const { conversations } = useJivoConversations()
  const { events } = useJivoEvents()
  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/jivo/webhook`
    : '/api/jivo/webhook'

  const copyWebhook = async () => {
    await navigator.clipboard?.writeText(webhookUrl)
  }

  const lastConversation = conversations[0]

  return (
    <Card id="jivo" className="crm-panel border-0 md:col-span-3">
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <PlugZap className="h-5 w-5 text-teal-600" />
            Интеграция Jivo
          </CardTitle>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Здесь готовим подключение Jivo: чаты, Instagram, Facebook, WhatsApp и другие каналы будут попадать в CRM,
            а KPI менеджера будет считаться автоматически.
          </p>
        </div>
        <Badge variant="outline" className="w-fit rounded-full border-teal-200 bg-teal-50 px-3 py-1 text-teal-700">
          Готово к webhook
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="rounded-3xl border bg-white p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Webhook className="h-4 w-4 text-teal-600" />
              Webhook URL для Jivo
            </div>
            <div className="break-all rounded-2xl bg-slate-50 px-4 py-3 font-mono text-sm text-slate-700">
              {webhookUrl}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={copyWebhook} className="h-11 rounded-2xl bg-teal-600 hover:bg-teal-700">
              <Copy className="mr-2 h-4 w-4" />
              Скопировать
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-2xl bg-white">
              <a href="https://www.jivochat.com/docs/webhooks/" target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Документация
              </a>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <StatusCard label="Диалогов Jivo" value={conversations.length} />
          <StatusCard label="Событий webhook" value={events.length} />
          <StatusCard label="Последний клиент" value={lastConversation?.client_name || '-'} />
          <StatusCard label="Канал" value={lastConversation?.source || '-'} />
        </div>

        <div className="rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50 to-sky-50 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-white p-3 text-teal-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-slate-950">Как подключать потом</div>
              <p className="mt-1 text-sm text-slate-600">
                В Jivo открой “Настройки CRM / CRM Webhooks”, включи Webhooks и вставь URL выше.
                После этого новые события Jivo можно сохранять в базу: кто принял чат, сколько ждал клиент,
                был ли звонок, консультация, запись и продажа.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl border bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 truncate text-xl font-semibold text-slate-950">{value}</div>
    </div>
  )
}

