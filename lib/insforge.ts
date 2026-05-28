import { createClient } from '@insforge/sdk'
import { localDb } from './local-db'

export const insforge = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!
})

// Local-first database for MVP/demo mode.
// It mirrors the small InsForge query API used by the UI and persists in browser localStorage.
export const db = localDb
