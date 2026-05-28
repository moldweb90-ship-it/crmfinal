import { addDays, endOfDay, format, isAfter, isBefore, isSameDay, parseISO, startOfDay } from 'date-fns'
import { ru } from 'date-fns/locale'

export const money = (value: number | string | null | undefined) =>
  `${new Intl.NumberFormat('ru-MD').format(Number(value || 0))} MDL`

export const leadStatuses: Record<string, { label: string; tone: string }> = {
  new: { label: 'Новая', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  contacted: { label: 'Связались', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  thinking: { label: 'Думает', tone: 'bg-violet-50 text-violet-700 border-violet-200' },
  scheduled: { label: 'Записан', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  came: { label: 'Пришел', tone: 'bg-teal-50 text-teal-700 border-teal-200' },
  not_came: { label: 'Не пришел', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  no_answer: { label: 'Не отвечает', tone: 'bg-orange-50 text-orange-700 border-orange-200' },
  cancelled: { label: 'Отменена', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  lost: { label: 'Потерян', tone: 'bg-slate-100 text-slate-600 border-slate-200' },
  converted: { label: 'Записан', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Отказ', tone: 'bg-slate-100 text-slate-600 border-slate-200' },
}

export const appointmentStatuses: Record<string, { label: string; tone: string }> = {
  planned: { label: 'План', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  confirmed: { label: 'Подтвержден', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  in_progress: { label: 'На приеме', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  completed: { label: 'Завершен', tone: 'bg-slate-100 text-slate-600 border-slate-200' },
  cancelled: { label: 'Отменен', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  no_show: { label: 'Не пришел', tone: 'bg-red-50 text-red-700 border-red-200' },
}

export const taskStatuses: Record<string, { label: string; tone: string }> = {
  open: { label: 'Открыта', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  in_progress: { label: 'В работе', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  done: { label: 'Готово', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Отмена', tone: 'bg-slate-100 text-slate-600 border-slate-200' },
}

export const planStatuses: Record<string, { label: string; tone: string }> = {
  draft: { label: 'Черновик', tone: 'bg-slate-100 text-slate-600 border-slate-200' },
  proposed: { label: 'Предложен', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  thinking: { label: 'Думает', tone: 'bg-violet-50 text-violet-700 border-violet-200' },
  accepted: { label: 'Принят', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  in_progress: { label: 'В лечении', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  completed: { label: 'Завершен', tone: 'bg-teal-50 text-teal-700 border-teal-200' },
  declined: { label: 'Отказ', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
}

export const sourceLabels: Record<string, string> = {
  phone: 'Телефон',
  website: 'Сайт',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  email: 'Email',
  referral: 'Рекомендация',
  other: 'Другое',
}

export const patientName = (appointment: any, patients: any[] = []) => {
  if (appointment?.patient_name) return appointment.patient_name
  const patient = patients.find((p) => p.id === appointment?.patient_id)
  return patient?.full_name || appointment?.notes || 'Пациент не указан'
}

export const dateLabel = (dateLike: string | Date | null | undefined, pattern = 'd MMM, HH:mm') => {
  if (!dateLike) return '-'
  const date = typeof dateLike === 'string' ? parseISO(dateLike) : dateLike
  return format(date, pattern, { locale: ru })
}

export const isDueToday = (dateLike: string | null | undefined) => {
  if (!dateLike) return false
  return isSameDay(parseISO(dateLike), new Date())
}

export const isOverdue = (dateLike: string | null | undefined) => {
  if (!dateLike) return false
  return isBefore(parseISO(dateLike), new Date())
}

export const todayRange = () => {
  const now = new Date()
  return { start: startOfDay(now), end: endOfDay(now) }
}

export const tomorrowRange = () => {
  const tomorrow = addDays(new Date(), 1)
  return { start: startOfDay(tomorrow), end: endOfDay(tomorrow) }
}

export const isInRange = (dateLike: string | null | undefined, start: Date, end: Date) => {
  if (!dateLike) return false
  const date = parseISO(dateLike)
  return (isAfter(date, start) || date.getTime() === start.getTime()) && (isBefore(date, end) || date.getTime() === end.getTime())
}
