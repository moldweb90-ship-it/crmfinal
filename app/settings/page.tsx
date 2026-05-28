import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LocalDataPanel } from '@/components/settings/local-data-panel'
import { JivoIntegrationPanel } from '@/components/settings/jivo-integration-panel'
import { GoogleCalendarPanel } from '@/components/settings/google-calendar-panel'

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-soft-in">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Настройки</h1>
        <p className="mt-1 text-slate-500">Роли, источники, услуги и параметры клиники. Заготовка для следующего этапа.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <LocalDataPanel />
        <JivoIntegrationPanel />
        <GoogleCalendarPanel />
        {[
          ['Роли', 'admin, manager, doctor'],
          ['Источники', 'телефон, сайт, WhatsApp, Instagram'],
          ['Интеграции', 'формы, телефония, SMS'],
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
