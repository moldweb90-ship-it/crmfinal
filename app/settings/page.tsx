import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SystemStatusPanel } from '@/components/settings/system-status-panel'
import { JivoIntegrationPanel } from '@/components/settings/jivo-integration-panel'
import { GoogleCalendarPanel } from '@/components/settings/google-calendar-panel'

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-soft-in">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Настройки</h1>
        <p className="mt-1 text-slate-500">Состояние системы, интеграции, календари и рабочие параметры клиники.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <SystemStatusPanel />
        <JivoIntegrationPanel />
        <GoogleCalendarPanel />
        {[
          ['Роли и доступы', 'admin, manager, doctor'],
          ['Источники заявок', 'телефон, сайт, WhatsApp, Instagram, Jivo'],
          ['Клиника', 'филиалы, врачи, график и услуги'],
        ].map(([title, text]) => (
          <Card key={title} className="crm-panel border-0">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                {title}
                <Badge variant="outline">скоро</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-500">{text}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
