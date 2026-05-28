'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { addDays, isBefore, parseISO, startOfDay } from 'date-fns'
import { Bell, CalendarPlus, CheckSquare2, ChevronDown, Inbox, Loader2, LogOut, Menu, Plus, Search, Settings, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useLeads, useTasks } from '@/lib/hooks'
import { useAuth } from '@/lib/auth'
import { appModules, canAccess, moduleForPath } from '@/lib/access-control'

const navItems = appModules.filter((item) => item.key !== 'settings')

const navGroups = [
  { title: 'Рабочий день', keys: ['dashboard', 'leads', 'tasks'] },
  { title: 'Пациенты', keys: ['appointments', 'schedule', 'patients'] },
  { title: 'Лечение и деньги', keys: ['treatment-plans', 'payments'] },
  { title: 'Аналитика', keys: ['reports', 'kpi'] },
  { title: 'Клиника', keys: ['doctors', 'users'] },
]

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading, logout } = useAuth()
  const { leads } = useLeads()
  const { tasks } = useTasks()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isLoginPage = pathname === '/login'
  const currentModule = moduleForPath(pathname)
  const hasAccess = isLoginPage || canAccess(user, currentModule)

  const newLeadsCount = leads.filter((lead: any) => lead.status === 'new').length
  const notifyUntil = addDays(startOfDay(new Date()), 2)
  const overdueTasksCount = tasks.filter((task: any) => {
    const due = task.due_at || task.due_date
    if (['done', 'cancelled'].includes(task.status) || !due) return false
    return isBefore(parseISO(due), startOfDay(new Date()))
  }).length
  const openTasksCount = tasks.filter((task: any) => {
    const due = task.due_at || task.due_date
    if (['done', 'cancelled'].includes(task.status) || !due) return false
    return isBefore(parseISO(due), notifyUntil)
  }).length
  const notificationCount = newLeadsCount + openTasksCount

  const visibleNav = navItems.filter((item) => canAccess(user, item.key))

  const badgeValue = (key?: string) => {
    if (key === 'leads') return newLeadsCount
    if (key === 'tasks') return openTasksCount
    return 0
  }

  useEffect(() => {
    if (loading) return
    if (!user && !isLoginPage) router.replace('/login')
    if (user && isLoginPage) router.replace('/')
  }, [loading, user, isLoginPage, router])

  useEffect(() => {
    visibleNav.forEach((item) => router.prefetch(item.href))
    if (canAccess(user, 'settings')) router.prefetch('/settings')
  }, [router, user, visibleNav])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
      </div>
    )
  }

  if (isLoginPage) return <>{children}</>

  if (!user) return null

  const initials = String(user.full_name || user.email || 'U').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen text-slate-950">
      <aside className="fixed left-0 top-0 z-30 hidden h-full w-[280px] flex-col border-r border-white/80 bg-white/90 px-4 py-5 shadow-[12px_0_45px_rgba(15,118,110,0.07)] backdrop-blur-xl lg:flex">
        <Link href="/" prefetch className="flex items-center gap-3 rounded-2xl px-2 py-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-sky-400 text-lg font-semibold text-white shadow-lg shadow-teal-500/20">
            L
          </div>
          <div>
            <div className="font-semibold tracking-tight">LIFE DENTAL</div>
            <div className="text-xs text-slate-500">manager CRM</div>
          </div>
        </Link>

        <nav className="mt-4 flex-1 space-y-2.5 overflow-y-auto pr-1">
          {navGroups.map((group) => {
            const groupItems = visibleNav.filter((item) => group.keys.includes(item.key))
            if (!groupItems.length) return null

            return (
              <div key={group.title} className="space-y-1">
                <div className="px-3 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  {group.title}
                </div>
                <div className="space-y-0.5">
                  {groupItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                    const count = badgeValue(item.key)
                    return (
                      <Link key={item.href} href={item.href} prefetch className={cn(
                        'group flex items-center justify-between rounded-2xl px-3 py-1.5 text-sm font-semibold transition-all',
                        isActive ? 'bg-gradient-to-r from-teal-500 to-sky-500 text-white shadow-lg shadow-teal-500/15' : 'text-slate-600 hover:bg-white hover:text-teal-700 hover:shadow-sm'
                      )}>
                        <span className="flex min-w-0 items-center gap-3">
                          <span className={cn(
                            'grid h-7 w-7 shrink-0 place-items-center rounded-xl transition',
                            isActive ? 'bg-white/15 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600'
                          )}>
                            <item.icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="truncate">{item.label}</span>
                        </span>
                        {count > 0 && (
                          <Badge className={cn('h-5 min-w-5 justify-center px-1.5 text-[11px]', isActive ? 'bg-white text-teal-700' : 'bg-teal-500 text-white')}>
                            {count}
                          </Badge>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="space-y-3 rounded-3xl border border-teal-100 bg-gradient-to-br from-white to-teal-50 p-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback className="bg-teal-500 text-white">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{user.full_name}</div>
              <div className="text-xs text-slate-500">{user.role === 'admin' ? 'Администратор' : 'Менеджер'}</div>
            </div>
          </div>
          <Button variant="outline" className="w-full rounded-2xl bg-white" onClick={() => { logout(); router.replace('/login') }}>
            <LogOut className="mr-2 h-4 w-4" />
            Выйти
          </Button>
        </div>
      </aside>

      <div className="lg:pl-[280px]">
        <header className="sticky top-0 z-20 border-b border-white/70 bg-white/70 px-4 py-3 backdrop-blur-xl md:px-7">
          <div className="flex items-center gap-3">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-xl lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[310px] border-white/80 bg-white/95 p-4 backdrop-blur-xl">
                <SheetTitle className="sr-only">Меню CRM</SheetTitle>
                <Link href="/" prefetch onClick={() => setMobileMenuOpen(false)} className="mb-5 flex items-center gap-3 rounded-2xl px-1 py-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-sky-400 text-base font-semibold text-white shadow-lg shadow-teal-500/20">
                    L
                  </div>
                  <div>
                    <div className="font-semibold tracking-tight">LIFE DENTAL</div>
                    <div className="text-xs text-slate-500">manager CRM</div>
                  </div>
                </Link>
                <nav className="space-y-2.5">
                  {navGroups.map((group) => {
                    const groupItems = visibleNav.filter((item) => group.keys.includes(item.key))
                    if (!groupItems.length) return null

                    return (
                      <div key={group.title} className="space-y-1">
                        <div className="px-2 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                          {group.title}
                        </div>
                        <div className="space-y-0.5">
                          {groupItems.map((item) => {
                            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                            const count = badgeValue(item.key)
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                prefetch
                                onClick={() => setMobileMenuOpen(false)}
                                className={cn(
                                  'group flex items-center justify-between rounded-2xl px-2.5 py-1.5 text-sm font-semibold transition-all',
                                  isActive ? 'bg-gradient-to-r from-teal-500 to-sky-500 text-white shadow-lg shadow-teal-500/15' : 'text-slate-600 hover:bg-teal-50 hover:text-teal-700'
                                )}
                              >
                                <span className="flex min-w-0 items-center gap-2.5">
                                  <span className={cn(
                                    'grid h-7 w-7 shrink-0 place-items-center rounded-xl transition',
                                    isActive ? 'bg-white/15 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-white group-hover:text-teal-600'
                                  )}>
                                    <item.icon className="h-3.5 w-3.5" />
                                  </span>
                                  <span className="truncate">{item.label}</span>
                                </span>
                                {count > 0 && (
                                  <Badge className={cn('h-5 min-w-5 justify-center px-1.5 text-[11px]', isActive ? 'bg-white text-teal-700' : 'bg-teal-500 text-white')}>
                                    {count}
                                  </Badge>
                                )}
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </nav>
              </SheetContent>
            </Sheet>
            <div className="relative hidden max-w-xl flex-1 md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Поиск пациента, заявки, телефона..."
                className="h-11 rounded-2xl border-white bg-white/80 pl-9 shadow-sm"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="relative rounded-2xl bg-white">
                    <Bell className="h-4 w-4" />
                    {notificationCount > 0 && (
                      <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                        {notificationCount > 9 ? '9+' : notificationCount}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 rounded-2xl">
                  <DropdownMenuLabel>Что требует внимания</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/leads" prefetch className="flex items-center justify-between">
                      <span className="flex items-center gap-2"><Inbox className="h-4 w-4" />Новые заявки</span>
                      <Badge variant="secondary">{newLeadsCount}</Badge>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/tasks" prefetch className="flex items-center justify-between">
                      <span className="flex items-center gap-2"><CheckSquare2 className="h-4 w-4" />Сегодня и завтра</span>
                      <Badge variant="secondary">{openTasksCount}</Badge>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/tasks" prefetch className="flex items-center justify-between">
                      <span className="flex items-center gap-2"><Bell className="h-4 w-4" />Просрочено</span>
                      <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-50">{overdueTasksCount}</Badge>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="rounded-2xl bg-gradient-to-r from-teal-500 to-sky-500 px-4 text-white shadow-lg shadow-teal-500/15 hover:from-teal-600 hover:to-sky-600">
                    <Plus className="mr-2 h-4 w-4" />
                    Создать
                    <ChevronDown className="ml-2 h-4 w-4 opacity-80" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl">
                  <DropdownMenuLabel>Быстро добавить</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {canAccess(user, 'leads') && (
                    <DropdownMenuItem asChild>
                      <Link href="/leads" prefetch><Inbox className="h-4 w-4" />Заявку</Link>
                    </DropdownMenuItem>
                  )}
                  {canAccess(user, 'appointments') && (
                    <DropdownMenuItem asChild>
                      <Link href="/appointments" prefetch><CalendarPlus className="h-4 w-4" />Запись</Link>
                    </DropdownMenuItem>
                  )}
                  {canAccess(user, 'tasks') && (
                    <DropdownMenuItem asChild>
                      <Link href="/tasks" prefetch><CheckSquare2 className="h-4 w-4" />Задачу</Link>
                    </DropdownMenuItem>
                  )}
                  {canAccess(user, 'patients') && (
                    <DropdownMenuItem asChild>
                      <Link href="/patients" prefetch><UserPlus className="h-4 w-4" />Пациента</Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-11 gap-2 rounded-2xl bg-white px-2.5 md:px-3">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-teal-500 text-xs text-white">{initials}</AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-[120px] truncate text-sm font-semibold md:inline">{user.full_name}</span>
                    <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-2xl">
                  <DropdownMenuLabel>
                    <div className="truncate">{user.full_name}</div>
                    <div className="text-xs font-normal text-slate-500">{user.role === 'admin' ? 'Администратор' : 'Менеджер'}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {canAccess(user, 'settings') && (
                    <DropdownMenuItem asChild>
                      <Link href="/settings" prefetch><Settings className="h-4 w-4" />Настройки</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => { logout(); router.replace('/login') }}>
                    <LogOut className="h-4 w-4" />
                    Выйти
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        <main className="px-4 pb-24 pt-6 md:px-7 lg:pb-6">
          {hasAccess ? children : <AccessDenied />}
        </main>
      </div>

      <nav className="fixed bottom-3 left-3 right-3 z-40 grid grid-cols-5 rounded-3xl border border-white/70 bg-white/90 p-1 shadow-[0_18px_55px_rgba(15,23,42,0.18)] backdrop-blur-xl lg:hidden">
        {visibleNav.slice(0, 5).map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          const count = badgeValue(item.key)
          return (
            <Link key={item.href} href={item.href} prefetch className={cn(
              'relative flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-medium transition',
              isActive ? 'bg-gradient-to-r from-teal-500 to-sky-500 text-white' : 'text-slate-500'
            )}>
              <item.icon className="mb-1 h-4 w-4" />
              <span className="max-w-full truncate">{item.label}</span>
              {count > 0 && <span className="absolute right-2 top-1 h-2 w-2 rounded-full bg-blue-500" />}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

function AccessDenied() {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-50 text-rose-600">
        <Settings className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-semibold text-slate-950">Нет доступа</h1>
      <p className="mt-2 text-slate-500">Администратор может открыть этот раздел в настройках пользователя.</p>
    </div>
  )
}
