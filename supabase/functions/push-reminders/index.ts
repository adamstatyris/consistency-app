import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@localhost'
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('URL') ?? ''
const SERVICE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''

/** Skip rows older than this (missed while cron was down). Matches the ~7-day schedule horizon
 *  so delayed sends still deliver after outages; rows older than this are skipped. */
const STALE_MS = 7 * 24 * 60 * 60 * 1000

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

function err(status: number, message: string) {
  console.error(`[push-reminders] ${status}: ${message}`)
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  try {
    if (!CRON_SECRET) return err(500, 'CRON_SECRET not configured')
    if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
      console.warn('[push-reminders] 401: x-cron-secret mismatch')
      return new Response('Unauthorized', { status: 401 })
    }

    if (!SUPABASE_URL || !SERVICE_KEY) return err(500, 'Missing SUPABASE_URL or SERVICE_ROLE')
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return err(500, 'VAPID keys not configured')

    const supa = createClient(SUPABASE_URL, SERVICE_KEY)
    const now = Date.now()
    const nowIso = new Date(now).toISOString()
    const staleIso = new Date(now - STALE_MS).toISOString()

    const { data: due, error: qErr } = await supa
      .from('reminder_schedule')
      .select('id,user_id,slot_key,title,body,tag,fire_at_utc')
      .is('sent_at', null)
      .lte('fire_at_utc', nowIso)
      .gte('fire_at_utc', staleIso)
      .order('fire_at_utc', { ascending: true })
      .limit(300)

    if (qErr) return err(500, qErr.message)

    let sent = 0
    const rows = due ?? []

    for (const row of rows) {
      const { data: subs, error: sErr } = await supa
        .from('push_subscriptions')
        .select('id,endpoint,p256dh,auth')
        .eq('user_id', row.user_id)

      if (sErr) continue

      const list = subs ?? []
      if (!list.length) continue

      const payload = JSON.stringify({
        title: row.title,
        body: row.body,
        tag: row.tag,
      })

      let delivered = false
      for (const s of list) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 300 },
          )
          delivered = true
        } catch (e: unknown) {
          const status =
            e && typeof e === 'object' && 'statusCode' in e
              ? (e as { statusCode: number }).statusCode
              : 0
          if (status === 410 || status === 404) {
            await supa.from('push_subscriptions').delete().eq('id', s.id)
          }
        }
      }

      if (delivered) {
        await supa
          .from('reminder_schedule')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', row.id)
        sent++
      }
    }

    const body = { scanned: rows.length, sent }
    console.log('[push-reminders] ok', JSON.stringify(body))
    return new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return err(500, `Unhandled: ${message}`)
  }
})
