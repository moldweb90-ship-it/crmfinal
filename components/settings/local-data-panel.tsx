'use client'

import { useEffect, useState } from 'react'
import { Database, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { localDb } from '@/lib/local-db'

const storageKey = 'lifedental_crm_local_db_v1'
const trackedTables = ['clinics', 'patients', 'leads', 'appointments', 'tasks', 'contact_history', 'treatment_plans', 'payments', 'doctors']

export function LocalDataPanel() {
  const [counts, setCounts] = useState<Record<string, number>>({})

  const refresh = () => {
    try {
      const store = JSON.parse(window.localStorage.getItem(storageKey) || '{}')
      setCounts(Object.fromEntries(trackedTables.map((table) => [table, Array.isArray(store[table]) ? store[table].length : 0])))
    } catch {
      setCounts({})
    }
  }

  useEffect(() => {
    refresh()
    window.addEventListener('lifedental-local-db-change', refresh)
    return () => window.removeEventListener('lifedental-local-db-change', refresh)
  }, [])

  return (
    <Card className="crm-panel border-0 md:col-span-3">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Локальная база
          </span>
          <Badge className="bg-emerald-600">включена</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-500">
          Данные сохраняются в браузере этого компьютера. Можно спокойно добавлять заявки, пациентов, задачи, планы и оплаты без InsForge.
        </p>
        <div className="grid gap-2 md:grid-cols-4">
          {trackedTables.map((table) => (
            <div key={table} className="rounded-2xl border bg-white p-3">
              <div className="text-xs text-slate-500">{table}</div>
              <div className="mt-1 text-xl font-semibold">{counts[table] ?? 0}</div>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          className="rounded-2xl"
          onClick={() => {
            if (confirm('Сбросить локальные CRM-данные и вернуть демо-врачей?')) {
              localDb.reset()
              refresh()
            }
          }}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Сбросить локальные данные
        </Button>
      </CardContent>
    </Card>
  )
}
