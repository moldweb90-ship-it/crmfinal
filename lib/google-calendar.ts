import { addMinutes } from 'date-fns'

export const googleSyncModes: Record<string, { label: string; description: string }> = {
  read_only: {
    label: 'Только читать',
    description: 'CRM показывает записи из Google, но не меняет календарь врача.',
  },
  two_way: {
    label: 'Двусторонняя',
    description: 'Позже можно будет создавать/обновлять события обратно в Google.',
  },
}

export function parseGoogleEventTitle(summary = '') {
  const cleaned = summary.trim()
  if (!cleaned) return { patient_name: 'Пациент из Google', service_name: 'Прием' }

  const separators = [' - ', ' — ', ' | ', ': ']
  const separator = separators.find((item) => cleaned.includes(item))
  if (!separator) return { patient_name: cleaned, service_name: 'Прием' }

  const [patient, ...rest] = cleaned.split(separator)
  return {
    patient_name: patient.trim() || cleaned,
    service_name: rest.join(separator).trim() || 'Прием',
  }
}

export function buildDemoGoogleEvent(source: any) {
  const start = new Date()
  start.setHours(15, 0, 0, 0)
  const end = addMinutes(start, 60)
  const parsed = parseGoogleEventTitle('Google пациент - Консультация')

  return {
    source_id: source.id,
    google_event_id: `demo-${source.id}-${Date.now()}`,
    calendar_id: source.calendar_id,
    doctor_id: source.doctor_id,
    clinic_id: source.clinic_id,
    patient_name: parsed.patient_name,
    service_name: parsed.service_name,
    description: 'Тестовая синхронизация. В боевом режиме сюда попадет событие из Google Calendar.',
    location: '',
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    status: 'confirmed',
    html_link: '',
    raw_payload: null,
    last_seen_at: new Date().toISOString(),
  }
}

