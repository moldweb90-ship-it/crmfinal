import { createClient } from '@insforge/sdk'
import { localDb } from './local-db'
import { remoteDb } from './remote-db'

export const insforge = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!
})

// Local mode is useful for quick desktop work. Production uses PostgreSQL through /api/db.
export const db = process.env.NEXT_PUBLIC_DB_MODE === 'server' ? remoteDb : localDb
