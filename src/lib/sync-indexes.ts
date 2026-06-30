import { FunctionsHttpError } from '@supabase/supabase-js'
import type { SyncMode } from '../types'
import { supabase } from './supabase'

const SYNC_URL = import.meta.env.VITE_SYNC_URL ?? '/api/sync-indexes'

async function parseResponseError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body?.error === 'string') return body.error
  } catch {
    // ignore
  }
  return `Sync failed (${res.status})`
}

/** PSX blocks Supabase Edge (462). Sync runs via Netlify Function on the same domain. */
export async function invokeSyncIndexes(mode: SyncMode = 'benchmark') {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('Please sign in again to sync indexes.')
  }

  const res = await fetch(SYNC_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mode }),
  })

  let body: {
    ok?: boolean
    error?: string
    counts?: Record<string, number>
    shariahCompliant?: number
    warning?: string
  } = {}

  try {
    body = await res.json()
  } catch {
    // ignore non-json
  }

  if (!res.ok) {
    const message = body.error ?? (await parseResponseError(res))
    if (message.includes('462')) {
      throw new Error(
        `${message} PSX blocks some cloud servers. Ensure sync runs via Netlify (/api/sync-indexes) with SUPABASE_SERVICE_ROLE_KEY set.`,
      )
    }
    throw new Error(message)
  }

  if (body.error) {
    throw new Error(body.error)
  }

  return {
    ok: true,
    counts: body.counts ?? {},
    shariahCompliant: body.shariahCompliant ?? 0,
    warning: body.warning,
  }
}

// Kept for type compatibility if anything still references edge invoke
export { FunctionsHttpError }
