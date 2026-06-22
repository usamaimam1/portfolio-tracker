import { FunctionsHttpError } from '@supabase/supabase-js'
import type { SyncMode } from '../types'
import { supabase } from './supabase'

async function parseFunctionError(error: FunctionsHttpError): Promise<string> {
  try {
    const body = await error.context.json()
    if (typeof body?.error === 'string') return body.error
  } catch {
    // ignore parse failures
  }
  return error.message
}

export async function invokeSyncIndexes(mode: SyncMode = 'benchmark') {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('Please sign in again to sync indexes.')
  }

  const { data, error } = await supabase.functions.invoke('sync-indexes', {
    method: 'POST',
    body: { mode },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (error) {
    const message =
      error instanceof FunctionsHttpError ? await parseFunctionError(error) : error.message
    throw new Error(message)
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return {
    ok: true,
    counts: data.counts ?? {},
    shariahCompliant: data.shariahCompliant ?? 0,
    warning: data.warning as string | undefined,
  }
}
