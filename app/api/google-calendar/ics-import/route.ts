import { NextRequest, NextResponse } from 'next/server'

function unfoldIcs(text: string) {
  return text.replace(/\r?\n[ \t]/g, '')
}

function cleanText(value = '') {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim()
}

function lineValue(line = '') {
  const index = line.indexOf(':')
  return index >= 0 ? line.slice(index + 1) : ''
}

function parseIcsDate(raw = '') {
  if (!raw) return null
  const value = raw.trim()

  if (/^\d{8}$/.test(value)) {
    return new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00`).toISOString()
  }

  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/)
  if (!match) return null

  const [, year, month, day, hour, minute, second, zulu] = match
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}${zulu ? 'Z' : ''}`
  return new Date(iso).toISOString()
}

function parseIcs(text: string) {
  const lines = unfoldIcs(text).split(/\r?\n/)
  const events: any[] = []
  let current: Record<string, string> | null = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {}
      continue
    }
    if (line === 'END:VEVENT') {
      if (current) events.push(current)
      current = null
      continue
    }
    if (!current) continue

    if (line.startsWith('UID')) current.uid = lineValue(line)
    if (line.startsWith('SUMMARY')) current.summary = cleanText(lineValue(line))
    if (line.startsWith('DESCRIPTION')) current.description = cleanText(lineValue(line))
    if (line.startsWith('LOCATION')) current.location = cleanText(lineValue(line))
    if (line.startsWith('DTSTART')) current.dtstart = lineValue(line)
    if (line.startsWith('DTEND')) current.dtend = lineValue(line)
    if (line.startsWith('STATUS')) current.status = lineValue(line).toLowerCase()
    if (line.startsWith('URL')) current.html_link = lineValue(line)
  }

  return events
    .map((event) => {
      const start = parseIcsDate(event.dtstart)
      const end = parseIcsDate(event.dtend)
      if (!start || !end) return null

      const summary = event.summary || 'Пациент из Google'
      const separator = [' - ', ' — ', ' | ', ': '].find((item) => summary.includes(item))
      const [patientName, ...serviceParts] = separator ? summary.split(separator) : [summary]

      return {
        google_event_id: event.uid || `${summary}-${start}`,
        patient_name: patientName?.trim() || summary,
        service_name: serviceParts.join(separator || '').trim() || 'Прием',
        description: event.description || '',
        location: event.location || '',
        start_time: start,
        end_time: end,
        status: event.status === 'cancelled' ? 'cancelled' : 'confirmed',
        html_link: event.html_link || '',
        raw_payload: event,
      }
    })
    .filter(Boolean)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const url = body?.url

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ result: 'error', message: 'ICS url is required' }, { status: 400 })
  }

  if (!url.startsWith('https://calendar.google.com/calendar/ical/')) {
    return NextResponse.json({ result: 'error', message: 'Only Google Calendar iCal URLs are allowed' }, { status: 400 })
  }

  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    return NextResponse.json({ result: 'error', message: `Google Calendar returned ${response.status}` }, { status: 502 })
  }

  const text = await response.text()
  const events = parseIcs(text)

  return NextResponse.json({
    result: 'ok',
    count: events.length,
    events,
  })
}

