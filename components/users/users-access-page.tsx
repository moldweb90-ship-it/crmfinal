'use client'

import { useState } from 'react'
import { Check, Loader2, Plus, ShieldCheck, UserCog } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { db } from '@/lib/insforge'
import { useManagers } from '@/lib/hooks'
import { appModules, managerDefaultPermissions } from '@/lib/access-control'
import { useAuth } from '@/lib/auth'

const emptyForm = {
  full_name: '',
  email: '',
  phone: '',
  password: '123456',
  role: 'manager',
}

export function UsersAccessPage() {
  const { managers, isLoading, mutate } = useManagers()
  const { refreshUser, user } = useAuth()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const createUser = async () => {
    if (!form.full_name || !form.email) return
    setSaving(true)
    try {
      await db.from('managers').insert([{
        ...form,
        is_active: true,
        permissions: form.role === 'admin' ? [] : managerDefaultPermissions,
      }])
      setForm(emptyForm)
      setOpen(false)
      mutate()
    } finally {
      setSaving(false)
    }
  }

  const updateUser = async (id: string, patch: Record<string, any>) => {
    await db.from('managers').update(patch).eq('id', id)
    mutate()
    if (id === user?.id) refreshUser()
  }

  const togglePermission = async (manager: any, moduleKey: string) => {
    const permissions = Array.isArray(manager.permissions) ? manager.permissions : []
    const next = permissions.includes(moduleKey)
      ? permissions.filter((item: string) => item !== moduleKey)
      : [...permissions, moduleKey]
    await updateUser(manager.id, { permissions: next })
  }

  return (
    <div className="space-y-6 animate-soft-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Пользователи и доступы</h1>
          <p className="mt-1 max-w-3xl text-slate-500">
            Администратор видит все. Для менеджеров можно включать и выключать конкретные вкладки CRM.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="h-11 rounded-2xl bg-gradient-to-r from-teal-500 to-sky-500 text-white hover:from-teal-600 hover:to-sky-600">
          <Plus className="mr-2 h-4 w-4" />
          Пользователь
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card className="crm-panel border-0">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-slate-950">
              <ShieldCheck className="h-5 w-5 text-teal-600" />
              Логика ролей
            </div>
            <div className="rounded-2xl bg-teal-50 p-4 text-sm text-teal-900">
              <b>Admin</b> может делать все: видеть все вкладки, менять пользователей, роли и доступы.
            </div>
            <div className="rounded-2xl bg-sky-50 p-4 text-sm text-sky-900">
              <b>Manager</b> видит только включенные вкладки. Если вкладку выключить, она исчезнет из меню и не откроется по прямой ссылке.
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              Сейчас это локальная авторизация для разработки. При переносе на домен ее можно заменить на серверную, сохранив ту же матрицу доступов.
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
          ) : managers.map((manager: any) => (
            <UserAccessCard
              key={manager.id}
              manager={manager}
              onUpdate={(patch) => updateUser(manager.id, patch)}
              onToggle={(moduleKey) => togglePermission(manager, moduleKey)}
            />
          ))}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader><DialogTitle>Новый пользователь</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>ФИО</Label>
              <Input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Телефон</Label>
                <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Пароль</Label>
                <Input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Роль</Label>
                <Select value={form.role} onValueChange={(role) => setForm({ ...form, role })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Менеджер</SelectItem>
                    <SelectItem value="admin">Администратор</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
            <Button onClick={createUser} disabled={saving} className="bg-teal-600 hover:bg-teal-700">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UserAccessCard({ manager, onUpdate, onToggle }: { manager: any; onUpdate: (patch: Record<string, any>) => void; onToggle: (moduleKey: string) => void }) {
  const permissions = Array.isArray(manager.permissions) ? manager.permissions : []
  const isAdmin = manager.role === 'admin'

  return (
    <Card className="crm-panel border-0">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-sky-500 text-lg font-semibold text-white">
              {String(manager.full_name || manager.email || 'U').slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-semibold text-slate-950">{manager.full_name}</div>
                <Badge variant="outline" className={isAdmin ? 'border-teal-200 bg-teal-50 text-teal-700' : 'bg-slate-50'}>{isAdmin ? 'Admin' : 'Manager'}</Badge>
                {manager.is_active === false && <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">Отключен</Badge>}
              </div>
              <div className="text-sm text-slate-500">{manager.email}</div>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Select value={manager.role || 'manager'} onValueChange={(role) => onUpdate({ role, permissions: role === 'admin' ? [] : permissions.length ? permissions : managerDefaultPermissions })}>
              <SelectTrigger className="h-10 rounded-2xl bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="rounded-2xl bg-white" onClick={() => onUpdate({ is_active: manager.is_active === false })}>
              {manager.is_active === false ? 'Включить' : 'Отключить'}
            </Button>
            <Button variant="outline" className="rounded-2xl bg-white" onClick={() => onUpdate({ password: window.prompt('Новый пароль', manager.password || '') || manager.password })}>
              Пароль
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {appModules.map((module) => {
            const checked = isAdmin || permissions.includes(module.key)
            return (
              <label key={module.key} className={`flex cursor-pointer gap-3 rounded-2xl border p-3 transition ${checked ? 'border-teal-200 bg-teal-50/60' : 'bg-white hover:bg-slate-50'} ${isAdmin ? 'opacity-75' : ''}`}>
                <Checkbox
                  checked={checked}
                  disabled={isAdmin}
                  onCheckedChange={() => onToggle(module.key)}
                  className="mt-1 h-5 w-5 rounded-lg border-teal-500 data-[state=checked]:bg-teal-500"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-semibold text-slate-900">
                    {checked && <Check className="h-3.5 w-3.5 text-teal-600" />}
                    {module.label}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">{module.description}</span>
                </span>
              </label>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
