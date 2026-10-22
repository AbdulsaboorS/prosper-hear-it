interface Env {
  AI: Ai
}

const SPEAKERS = new Set(['thalia', 'andromeda', 'helena', 'athena', 'hera', 'luna', 'asteria', 'aurora', 'arcas', 'apollo', 'orion', 'odysseus', 'orpheus', 'hermes'])

// Deepgram Aura-2 on Workers AI. About 0.3s to first byte, so it keeps up with a live conversation.
// Most lines are scripted, so responses are cached at the edge to save Workers AI usage across demos.
export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const { text, speaker: requested } = (await request.json()) as { text: string; speaker?: string }
  if (!text || text.length > 600) return new Response('bad text', { status: 400 })
  const speaker = requested && SPEAKERS.has(requested) ? requested : 'thalia'

  const key = new Request(`https://tts.cache/${speaker}/${await sha256(text)}`)
  const hit = await caches.default.match(key)
  if (hit) return hit

  const audio = (await env.AI.run('@cf/deepgram/aura-2-en' as never, { text, speaker, encoding: 'mp3' } as never)) as unknown as ReadableStream
  const [forClient, forCache] = audio.tee()
  const headers = { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=604800' }
  waitUntil(caches.default.put(key, new Response(forCache, { headers })))
  return new Response(forClient, { headers })
}

async function sha256(s: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
