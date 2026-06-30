import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { logSyncRun, runIndexSync, type SyncMode } from './_shared/run-sync.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-cron-secret',
  'Content-Type': 'application/json',
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing Supabase environment variables on Netlify.' }),
    }
  }

  let mode: SyncMode = 'benchmark'
  if (event.body) {
    try {
      const body = JSON.parse(event.body)
      if (body?.mode === 'listings' || body?.mode === 'full') mode = body.mode
    } catch {
      // ignore
    }
  }

  const cronSecret = process.env.CRON_SECRET
  const cronHeader = event.headers['x-cron-secret'] ?? event.headers['X-Cron-Secret']
  const isCron = cronSecret && cronHeader === cronSecret

  if (!isCron) {
    const authHeader = event.headers.authorization ?? event.headers.Authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unauthorized — sign in and try again.' }),
      }
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser()

    if (authError || !user) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: authError?.message ?? 'Unauthorized' }),
      }
    }
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  let runId: string | undefined

  try {
    runId = await logSyncRun(supabase, {
      triggeredBy: isCron ? 'cron' : 'manual',
      session: 'manual',
      mode,
      status: 'running',
    })

    const result = await runIndexSync(supabase, mode)

    if (runId) {
      await logSyncRun(supabase, {
        triggeredBy: isCron ? 'cron' : 'manual',
        session: 'manual',
        mode,
        status: 'success',
        counts: result.counts,
        runId,
      })
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true, mode, ...result }),
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sync failed'
    if (runId) {
      await logSyncRun(supabase, {
        triggeredBy: isCron ? 'cron' : 'manual',
        session: 'manual',
        mode,
        status: 'error',
        error: message,
        runId,
      })
    }
    console.error('netlify sync-indexes:', message)
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: message }) }
  }
}
