import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FIREBASE_SERVICE_ACCOUNT_JSON = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')!
const WEBHOOK_SECRET = Deno.env.get('DUNTA_WEBHOOK_SECRET') || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}

function b64url(input: Uint8Array | string) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function pemToBytes(pem: string) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')
  const bin = atob(b64)
  return Uint8Array.from(bin, c => c.charCodeAt(0))
}

async function firebaseAccessToken() {
  const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON)
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const unsigned = `${header}.${claim}`
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToBytes(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const assertion = `${unsigned}.${b64url(new Uint8Array(signature))}`
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  })
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body,
  })
  if (!r.ok) throw new Error(`Firebase OAuth ${r.status}: ${await r.text()}`)
  return (await r.json()).access_token as string
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371
  const dLat = (bLat - aLat) * Math.PI / 180
  const dLng = (bLng - aLng) * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

async function sendFcm(tokens: string[], title: string, body: string, data: Record<string, string>) {
  if (!tokens.length) return { sent: 0, failed: 0 }
  const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON)
  const accessToken = await firebaseAccessToken()
  let sent = 0, failed = 0
  const results = await Promise.all(tokens.map(async token => {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ message: { token, data: { ...data, title, body }, android: { priority: 'HIGH' } } }),
    })
    if (r.ok) return true
    const text = await r.text()
    if (r.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/i.test(text)) {
      await supabase.from('push_tokens').update({ enabled: false, updated_at: new Date().toISOString() }).eq('token', token)
    }
    console.error('FCM delivery failed', r.status, text)
    return false
  }))
  for (const ok of results) ok ? sent++ : failed++
  return { sent, failed }
}

async function driverTokens(ride: any) {
  const { data: drivers, error } = await supabase.from('drivers_locations')
    .select('driver_id,latitude,longitude,vehicle_type')
    .eq('is_online', true)
  if (error) throw error

  const eligible = (drivers || []).filter((d: any) => {
    if (!d.driver_id || ride.passenger_lat == null || ride.passenger_lng == null || d.latitude == null || d.longitude == null) return false
    if (ride.vehicle_type !== 'any' && d.vehicle_type !== ride.vehicle_type) return false
    return distanceKm(+ride.passenger_lat, +ride.passenger_lng, +d.latitude, +d.longitude) <= 15
  }).map((d: any) => d.driver_id)

  if (!eligible.length) return []

  const { data: rows, error: pe } = await supabase.from('push_tokens')
    .select('token')
    .in('user_id', [...new Set(eligible)])
    .eq('platform', 'android')
    .eq('enabled', true)
  if (pe) throw pe

  return [...new Set((rows || []).map((x: any) => x.token).filter(Boolean))]
}

async function passengerTokens(userId: string) {
  const { data, error } = await supabase.from('push_tokens')
    .select('token')
    .eq('user_id', userId)
    .eq('platform', 'android')
    .eq('enabled', true)
  if (error) throw error
  return [...new Set((data || []).map((x: any) => x.token).filter(Boolean))]
}

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!WEBHOOK_SECRET) return json({ error: 'DUNTA_WEBHOOK_SECRET_not_configured' }, 503)
  if (req.headers.get('x-dunta-webhook-secret') !== WEBHOOK_SECRET) return json({ error: 'unauthorized' }, 401)

  try {
    const payload = await req.json()
    if (payload.schema && payload.schema !== 'public') return json({ ok: true, ignored: true })
    if (payload.table && payload.table !== 'ride_requests') return json({ ok: true, ignored: true })

    const ride = payload.record || payload.ride || payload
    const old = payload.old_record || {}
    const event = String(payload.type || payload.eventType || '').toUpperCase()

    if (!ride?.id) return json({ error: 'ride_record_missing' }, 400)

    let result = { sent: 0, failed: 0 }

    if ((event === 'INSERT' || !event) && ride.status === 'pending') {
      const tokens = await driverTokens(ride)
      result = await sendFcm(
        tokens,
        'Novo pedido DUNTA',
        `${ride.passenger_name || 'Passageiro'} pediu uma corrida`,
        { type: 'rides', ride_id: String(ride.id) }
      )
    } else if (event === 'UPDATE') {
      if (old.status !== 'accepted' && ride.status === 'accepted' && ride.passenger_id) {
        const tokens = await passengerTokens(ride.passenger_id)
        result = await sendFcm(
          tokens,
          'Motorista encontrado',
          `${ride.driver_name || 'O motorista'} aceitou a sua corrida`,
          { type: 'trip', ride_id: String(ride.id), status: 'accepted' }
        )
      } else if (old.status !== 'completed' && ride.status === 'completed' && ride.passenger_id) {
        const tokens = await passengerTokens(ride.passenger_id)
        result = await sendFcm(
          tokens,
          'Corrida concluída',
          'A sua viagem foi concluída.',
          { type: 'trip', ride_id: String(ride.id), status: 'completed' }
        )
      } else if (old.status !== 'cancelled' && ride.status === 'cancelled') {
        const targets = [ride.passenger_id, ride.driver_id].filter(Boolean) as string[]
        let sent = 0, failed = 0
        for (const target of [...new Set(targets)]) {
          const tokens = await passengerTokens(target)
          const r = await sendFcm(
            tokens,
            'Corrida cancelada',
            'A corrida foi cancelada.',
            { type: 'trip', ride_id: String(ride.id), status: 'cancelled' }
          )
          sent += r.sent
          failed += r.failed
        }
        result = { sent, failed }
      }
    }

    return json({ ok: true, ...result })
  } catch (e) {
    console.error(e)
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
