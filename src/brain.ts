import type { Profile } from './data'
import { localTurn, type StepId, type TurnResult } from './flow'

const TIMEOUT_MS = 6000

// Ask the Workers AI model to understand the reply; fall back to keyword rules
// if the API is down, slow, or returns something unusable.
export async function understand(step: StepId, question: string, utterance: string, profile: Profile): Promise<TurnResult> {
  const local = localTurn(step, utterance, profile)
  try {
    const res = await fetch('/api/turn', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ step, question, utterance, profile: strip(profile) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`turn ${res.status}`)
    const llm = (await res.json()) as { slots?: Partial<Profile>; ack?: string; advance?: boolean; playSample?: string }
    if (typeof llm.advance !== 'boolean') throw new Error('bad shape')

    // Keep anything the keyword pass caught that the model missed.
    const slots = { ...local.slots, ...clean(llm.slots ?? {}) }
    const advance = llm.advance || (local.advance && step !== 'intro' && step !== 'book')
    return {
      slots,
      ack: punctuate((llm.ack ?? '').trim()) || (advance ? local.ack : ''),
      advance,
      playSample: step === 'tour' ? (llm.playSample === 'none' ? undefined : llm.playSample ?? local.playSample) : undefined,
      source: 'llm',
    }
  } catch (err) {
    console.warn('Falling back to local understanding', err)
    return local
  }
}

function clean(slots: Partial<Profile>): Partial<Profile> {
  const out: Record<string, unknown> = {}
  for (const [k, raw] of Object.entries(slots)) {
    // The model occasionally leaks JSON punctuation into string values.
    const v = typeof raw === 'string' ? raw.replace(/['"{},\s]+$/, '').trim() : raw
    if (v === null || v === '' || (Array.isArray(v) && !v.length)) continue
    out[k] = v
  }
  const trigger = out.humanTrigger as string | undefined
  if (trigger && !/^(you|your)\b/i.test(trigger)) out.humanTrigger = `you're ${trigger}`
  for (const k of ['humanRule', 'specialty', 'greetingStyle', 'toneNotes']) {
    if (typeof out[k] === 'string') out[k] = (out[k] as string).replace(/^./, (c) => c.toUpperCase())
  }
  if (typeof out.role === 'string') out.role = (out.role as string).replace(/\b(?!of\b|and\b)\w/g, (c) => c.toUpperCase())
  return out as Partial<Profile>
}

function strip(p: Profile) {
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length)))
}

const punctuate = (s: string) => (s && !/[.!?]$/.test(s) ? `${s}.` : s)
