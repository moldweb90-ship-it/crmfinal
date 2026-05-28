import { addDays, format, isAfter, isBefore, isSameDay, parseISO, startOfDay } from 'date-fns'
import { ru } from 'date-fns/locale'

export const patientStatusLabels: Record<string, { label: string; tone: string }> = {
  active: { label: 'Активный', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  thinking: { label: 'Думает', tone: 'bg-violet-50 text-violet-700 border-violet-200' },
  needs_follow_up: { label: 'Нужен контакт', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  checkup_due: { label: 'Плановый осмотр', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  inactive: { label: 'Спящий', tone: 'bg-slate-100 text-slate-600 border-slate-200' },
}

export const patientSources = [
  { value: 'phone', label: 'Телефон' },
  { value: 'website', label: 'Сайт' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'google', label: 'Google / Maps' },
  { value: 'referral', label: 'Рекомендация' },
  { value: 'walk_in', label: 'Прошел мимо' },
  { value: 'returning', label: 'Повторный пациент' },
  { value: 'other', label: 'Другое' },
]

export const paymentPreferences: Record<string, { label: string; tone: string }> = {
  unknown: { label: 'Не уточнено', tone: 'bg-slate-100 text-slate-600 border-slate-200' },
  full: { label: 'Полная оплата', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  credit: { label: 'В кредит', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
}

export const scanTypes = [
  { value: 'dicom_zip', label: 'DICOM / ZIP с томографии' },
  { value: 'pdf', label: 'PDF заключение' },
  { value: 'image', label: 'JPG / PNG скриншот' },
  { value: 'model', label: 'STL / PLY / OBJ модель' },
  { value: 'link', label: 'Ссылка на облако/томографию' },
  { value: 'other', label: 'Другое' },
]

export const sourceLabel = (value?: string | null) =>
  patientSources.find((source) => source.value === value)?.label || 'Не указан'

export const scanTypeLabel = (value?: string | null) =>
  scanTypes.find((type) => type.value === value)?.label || 'Не указан'

export function dateOnly(dateLike?: string | null) {
  if (!dateLike) return ''
  return dateLike.includes('T') ? dateLike.slice(0, 10) : dateLike
}

export function isDateTodayOrOverdue(dateLike?: string | null) {
  if (!dateLike) return false
  const date = startOfDay(parseISO(dateOnly(dateLike)))
  const today = startOfDay(new Date())
  return isSameDay(date, today) || isBefore(date, today)
}

export function isBirthdaySoon(dateLike?: string | null, days = 14) {
  if (!dateLike) return false
  const today = startOfDay(new Date())
  const birthday = parseISO(dateOnly(dateLike))
  let nextBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate())
  if (isBefore(nextBirthday, today)) {
    nextBirthday = new Date(today.getFullYear() + 1, birthday.getMonth(), birthday.getDate())
  }
  return isSameDay(nextBirthday, today) || (isAfter(nextBirthday, today) && isBefore(nextBirthday, addDays(today, days + 1)))
}

export function birthdayLabel(dateLike?: string | null) {
  if (!dateLike) return 'Не указано'
  const birthday = parseISO(dateOnly(dateLike))
  return format(birthday, 'd MMMM', { locale: ru })
}

export function patientFocusReason(patient: any) {
  if (isDateTodayOrOverdue(patient.next_follow_up_at)) return 'Связаться сегодня'
  if (isDateTodayOrOverdue(patient.planned_checkup_at)) return 'Плановый осмотр'
  if (isBirthdaySoon(patient.birth_date, 7)) return 'День рождения скоро'
  if (patient.status === 'thinking') return 'Думает над лечением'
  return null
}
