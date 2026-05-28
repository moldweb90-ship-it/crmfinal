import {
  BarChart3,
  CalendarDays,
  CheckSquare2,
  CreditCard,
  Inbox,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Stethoscope,
  UsersRound,
  WalletCards,
} from 'lucide-react'

export const appModules = [
  { key: 'dashboard', href: '/', icon: LayoutDashboard, label: 'Главная', description: 'Рабочий экран и ежедневная сводка менеджера.' },
  { key: 'leads', href: '/leads', icon: Inbox, label: 'Заявки', description: 'Входящие заявки, потерянные клиенты и конверсия в запись.' },
  { key: 'tasks', href: '/tasks', icon: CheckSquare2, label: 'Задачи', description: 'Задачи, напоминания и автоматические касания.' },
  { key: 'appointments', href: '/appointments', icon: CalendarDays, label: 'Записи', description: 'Список записей и статусы приемов.' },
  { key: 'schedule', href: '/schedule', icon: CalendarDays, label: 'Расписание', description: 'Календарь врачей, филиалов и доступного времени.' },
  { key: 'patients', href: '/patients', icon: UsersRound, label: 'Пациенты', description: 'База пациентов, карточки, контакты и история.' },
  { key: 'treatment-plans', href: '/treatment-plans', icon: WalletCards, label: 'Планы', description: 'Планы лечения, суммы, оплаты и дожим.' },
  { key: 'payments', href: '/payments', icon: CreditCard, label: 'Оплаты', description: 'Платежи, методы оплаты и привязка к планам.' },
  { key: 'reports', href: '/reports', icon: BarChart3, label: 'Отчеты', description: 'Отчеты по источникам, оплатам и посещаемости.' },
  { key: 'kpi', href: '/kpi', icon: BarChart3, label: 'KPI', description: 'Показатели менеджеров и Jivo-метрики.' },
  { key: 'doctors', href: '/doctors', icon: Stethoscope, label: 'Врачи', description: 'Врачи, профили, фото и специализации.' },
  { key: 'users', href: '/users', icon: ShieldCheck, label: 'Пользователи', description: 'Команда, роли и доступы к разделам.' },
  { key: 'settings', href: '/settings', icon: Settings, label: 'Настройки', description: 'Интеграции, Google Calendar, Jivo и локальные данные.' },
]

export const managerDefaultPermissions = [
  'dashboard',
  'leads',
  'tasks',
  'appointments',
  'schedule',
  'patients',
  'treatment-plans',
  'payments',
  'reports',
  'doctors',
]

export function moduleForPath(pathname: string) {
  if (pathname === '/') return 'dashboard'
  const segment = pathname.split('/').filter(Boolean)[0]
  return segment || 'dashboard'
}

export function canAccess(user: any, moduleKey: string) {
  if (!user) return false
  if (user.role === 'admin') return true
  return Array.isArray(user.permissions) && user.permissions.includes(moduleKey)
}
