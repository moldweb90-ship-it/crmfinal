import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))

  return NextResponse.json({
    result: 'ok',
    mode: 'contract-ready',
    message: 'Google Calendar sync endpoint is ready. Production mode should use OAuth refresh tokens, Calendar Events.list and persist events into google_calendar_events.',
    received: {
      source_id: body?.source_id || null,
      calendar_id: body?.calendar_id || null,
    },
  })
}

export async function GET() {
  return NextResponse.json({
    result: 'ok',
    service: 'LIFE DENTAL Google Calendar sync',
    production_flow: [
      'Connect Google OAuth',
      'Store refresh token securely on server',
      'Call Calendar API events.list per calendar',
      'Use nextSyncToken for incremental sync',
      'Save events into google_calendar_events',
      'Show events in CRM schedule by doctor and clinic',
    ],
  })
}

