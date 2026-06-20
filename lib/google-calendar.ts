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
