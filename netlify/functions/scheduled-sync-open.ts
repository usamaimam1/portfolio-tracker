import type { Config } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { logSyncRun, runIndexSync } from './_shared/run-sync.ts'
import { generateSnapshots } from './_shared/snapshots.ts'

async function runScheduled(session: 'open' | 'close') {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const cronSecret = process.env.CRON_SECRET

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  if (!cronSecret) {
    throw new Error('CRON_SECRET is not configured')
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const runId = await logSyncRun(supabase, {
    triggeredBy: `cron_${session}`,
    session,
    mode: 'full',
    status: 'running',
  })

  try {
    const result = await runIndexSync(supabase, 'full')

    if (runId) {
      await logSyncRun(supabase, {
        triggeredBy: `cron_${session}`,
        session,
        mode: 'full',
        status: 'success',
        counts: result.counts,
        runId,
      })
    }

    await generateSnapshots(supabase, session)

    return { ok: true, session, ...result }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Scheduled sync failed'
    if (runId) {
      await logSyncRun(supabase, {
        triggeredBy: `cron_${session}`,
        session,
        mode: 'full',
        status: 'error',
        error: message,
        runId,
      })
    }
    throw e
  }
}

export default async () => {
  try {
    const result = await runScheduled('open')
    return { statusCode: 200, body: JSON.stringify(result) }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Scheduled open sync failed'
    console.error(message)
    return { statusCode: 500, body: JSON.stringify({ error: message }) }
  }
}

export const config: Config = {
  schedule: '30 4 * * 1-5',
}
