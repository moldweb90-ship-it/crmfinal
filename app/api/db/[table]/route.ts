import { NextRequest, NextResponse } from 'next/server'
import { deleteRows, insertRows, selectRows, updateRows } from '@/lib/server-db'

export const dynamic = 'force-dynamic'

function ok(data: any) {
  return NextResponse.json({ data, error: null })
}

function fail(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : 'Database error'
  return NextResponse.json({ data: null, error: message }, { status })
}

function filterFromUrl(request: NextRequest) {
  const search = request.nextUrl.searchParams
  const eqField = search.get('eqField')
  const eqValue = search.get('eqValue')
  return eqField && eqValue != null ? { field: eqField, value: eqValue } : undefined
}

export async function GET(request: NextRequest, { params }: { params: { table: string } }) {
  try {
    const search = request.nextUrl.searchParams
    const data = await selectRows(params.table, {
      eqField: search.get('eqField'),
      eqValue: search.get('eqValue'),
      orderField: search.get('orderField') || 'created_at',
      ascending: search.get('ascending') === 'true',
    })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function POST(request: NextRequest, { params }: { params: { table: string } }) {
  try {
    const body = await request.json()
    const data = await insertRows(params.table, body.rows ?? body)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { table: string } }) {
  try {
    const body = await request.json()
    const data = await updateRows(params.table, body.values ?? body, body.filter ?? filterFromUrl(request))
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { table: string } }) {
  try {
    const data = await deleteRows(params.table, filterFromUrl(request))
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}
