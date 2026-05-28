export type ClinicHours = {
  closed?: boolean
  start?: string
  end?: string
}

export const clinicHoursByDay: Record<number, ClinicHours> = {
  0: { closed: true },
  1: { start: '07:00', end: '21:00' },
  2: { start: '07:00', end: '21:00' },
  3: { start: '07:00', end: '21:00' },
  4: { start: '07:00', end: '21:00' },
  5: { start: '07:00', end: '21:00' },
  6: { start: '08:30', end: '14:00' },
}

export const clinicWorkSummary = 'Пн-Пт 07:00-21:00 · Сб 08:30-14:00 · Вс выходной'

export function getClinicHours(date: Date) {
  return clinicHoursByDay[date.getDay()] || { closed: true }
}

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

const toTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export function buildClinicSlots(date: Date, interval = 30) {
  const hours = getClinicHours(date)
  if (hours.closed || !hours.start || !hours.end) return []

  const start = toMinutes(hours.start)
  const end = toMinutes(hours.end)
  const slots: string[] = []

  for (let current = start; current < end; current += interval) {
    slots.push(toTime(current))
  }

  return slots
}

export function isTimeWithinClinicHours(date: Date, time: string) {
  const hours = getClinicHours(date)
  if (hours.closed || !hours.start || !hours.end) return false

  const minutes = toMinutes(time)
  return minutes >= toMinutes(hours.start) && minutes < toMinutes(hours.end)
}

export function isAppointmentWithinClinicHours(date: Date, time: string, durationMinutes: number) {
  const hours = getClinicHours(date)
  if (hours.closed || !hours.start || !hours.end) return false

  const start = toMinutes(time)
  const end = start + durationMinutes
  return start >= toMinutes(hours.start) && end <= toMinutes(hours.end)
}
