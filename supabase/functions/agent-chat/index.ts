// Supabase Edge Function (Deno): agent-chat
//
// Bezpieczne proxy do Anthropic API. Klucz ANTHROPIC_API_KEY zostaje po stronie
// serwera (sekret Supabase), nigdy nie trafia do przegladarki.
//
// Odbiera POST JSON: { system: string, messages: {role, content}[], model?: string }
// Zwraca JSON: { text: string }
//
// === JAK WDROZYC ===
// 1. Zainstaluj Supabase CLI i zaloguj sie: supabase login
// 2. Powiaz projekt: supabase link --project-ref <TWOJ_REF>
// 3. Ustaw sekret z kluczem Anthropic:
//      supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// 4. Wdroz funkcje:
//      supabase functions deploy agent-chat
// 5. We froncie ustaw VITE_AGENT_API_URL na adres funkcji, np.:
//      https://<TWOJ_REF>.supabase.co/functions/v1/agent-chat
//
// Uwaga: domyslnie Supabase wymaga naglowka Authorization (anon key) dla funkcji.
// Jesli chcesz wywolac bez tego, wdroz z flaga: supabase functions deploy agent-chat --no-verify-jwt

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const DEFAULT_MODEL = 'claude-sonnet-4-6'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  })
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Dozwolona tylko metoda POST.' }, 405)
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return json(
      { error: 'Brak sekretu ANTHROPIC_API_KEY po stronie serwera. Ustaw go przez supabase secrets set.' },
      500,
    )
  }

  let payload: { system?: string; messages?: unknown; model?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Nieprawidlowy JSON w zadaniu.' }, 400)
  }

  const { system, messages, model } = payload

  if (!system || typeof system !== 'string') {
    return json({ error: 'Pole "system" jest wymagane (string).' }, 400)
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'Pole "messages" jest wymagane (niepusta tablica).' }, 400)
  }

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        max_tokens: 1500,
        system,
        messages,
      }),
    })

    if (!res.ok) {
      let detail = ''
      try {
        const errBody = await res.json()
        detail = errBody?.error?.message ?? JSON.stringify(errBody)
      } catch {
        detail = await res.text().catch(() => '')
      }
      return json({ error: `Anthropic API zwrocilo blad (HTTP ${res.status}). ${detail}`.trim() }, 502)
    }

    const data = await res.json()
    const text: string | undefined = data?.content?.[0]?.text
    if (!text) {
      return json({ error: 'Model zwrocil pusta odpowiedz.' }, 502)
    }

    return json({ text })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: `Blad proxy podczas rozmowy z modelem: ${msg}.` }, 500)
  }
})
