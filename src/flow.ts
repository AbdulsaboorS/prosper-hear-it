import {
  AGENTS, CALL_TYPES, teamFor, type CallType, type Ehr, type Language, type PainTime, type Profile,
} from './data'

export type StepId = 'intro' | 'calls' | 'warmth' | 'tour' | 'book' | 'confirm' | 'done'

export type View = 'setup' | 'team' | 'greeting' | 'book'

export interface Step {
  id: StepId
  view: View
  // Which of the four questions this is, for the progress bar.
  question?: number
  ask: (p: Profile) => string
  quickReplies?: string[]
  multi?: boolean
}

export const QUESTION_COUNT = 4

export const STEPS: Step[] = [
  {
    id: 'intro', view: 'setup', question: 1,
    ask: () =>
      "Hi, I'm Prosper Guide. Let's set up your AI front desk in under a minute. What's your name, and tell me about your practice: specialty, size, and EHR?",
    quickReplies: ['Dermatology, 12 providers, on ModMed', 'OB-GYN, 8 providers, on eClinicalWorks', 'GI, 20 providers, on athenahealth'],
  },
  {
    id: 'calls', view: 'setup', question: 2, multi: true,
    ask: () => "Which calls eat up your front desk's day, and when do the phones hurt the most?",
    quickReplies: [...CALL_TYPES.map((c) => c.label), 'Mornings', 'After hours', 'All day'],
  },
  {
    id: 'warmth', view: 'setup', question: 3,
    ask: (p) =>
      `Last one${p.name ? `, ${p.name}` : ''}, and it matters most. How does your front desk make patients feel welcome, and when should they always get a real person? Any languages, too.`,
    quickReplies: ['Greet by name, never rush them. Anyone upset gets a human. English and Spanish.'],
  },
  {
    id: 'tour', view: 'team',
    ask: () => '',
    quickReplies: ['Play a sample call', 'No thanks, keep going'],
  },
  { id: 'book', view: 'book', question: 4, ask: () => '' },
  {
    id: 'confirm', view: 'book',
    ask: () => 'Want me to send it to our team?',
    quickReplies: ['Yes, send it', 'Not yet'],
  },
  { id: 'done', view: 'book', ask: () => '' },
]

export const stepIndex = (id: StepId) => STEPS.findIndex((s) => s.id === id)
export const nextStep = (id: StepId): StepId => STEPS[Math.min(stepIndex(id) + 1, STEPS.length - 1)].id

// What the brain hands back for one user turn. The LLM fills this in;
// `localTurn` below is the keyword fallback with the same shape.
// Result of understanding one reply. `localTurn` produces it instantly from keywords;
// the model (src/brain.ts) produces the same shape in the background.
export interface TurnResult {
  slots: Partial<Profile>
  advance: boolean
  // What to ask when the step isn't complete yet.
  clarify?: string
  playSample?: string
}


const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w))

export function extractCallTypes(t: string): CallType[] {
  const out: CallType[] = []
  if (has(t, 'schedul', 'appointment', 'booking', 'book')) out.push('scheduling')
  if (has(t, 'billing', 'bill', 'balance', 'payment', 'statement')) out.push('billing')
  if (has(t, 'benefit', 'eligib', 'verification', 'coverage', 'insurance')) out.push('benefits')
  if (has(t, 'prior auth', 'authoriz', 'pre-auth', 'preauth', 'auth')) out.push('priorAuth')
  if (has(t, 'remind', 'confirm', 'no-show', 'no show')) out.push('reminders')
  if (has(t, 'switchboard', 'routing', 'transfer', 'front line', 'operator')) out.push('switchboard')
  if (has(t, 'claim', 'denial', 'denied')) out.push('claims')
  if (has(t, 'refill', 'prescription', 'pharmacy')) out.push('refills')
  if (has(t, 'recall', 're-engage', 'reengage', 'overdue')) out.push('recall')
  return [...new Set(out)]
}

function extractEhr(t: string): Ehr | undefined {
  if (has(t, 'athena')) return 'athenahealth'
  if (has(t, 'modmed', 'mod med', 'modernizing')) return 'ModMed'
  if (has(t, 'eclinical', 'ecw', 'e clinical')) return 'eClinicalWorks'
  if (has(t, 'epic')) return 'Epic'
  if (has(t, 'nextgen', 'next gen')) return 'NextGen'
  if (has(t, 'other', 'something else', 'different')) return 'Other'
}

function extractPain(t: string): PainTime[] {
  if (has(t, 'all day', 'constantly', 'always')) return ['all day']
  const out: PainTime[] = []
  if (has(t, 'morning', 'open')) out.push('mornings')
  if (has(t, 'lunch', 'noon', 'midday')) out.push('lunch')
  if (has(t, 'after hours', 'after-hours', 'night', 'evening', 'weekend')) out.push('after hours')
  return out
}

function extractNumber(t: string, near: RegExp): number | undefined {
  const words: Record<string, number> = {
    a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
    hundred: 100, thousand: 1000,
  }
  const m = t.match(near)
  if (!m) return
  const raw = m[1].replace(/,/g, '')
  if (/^\d+$/.test(raw)) return Number(raw)
  const parts = raw.split(/[\s-]+/).map((w) => words[w]).filter((n) => n !== undefined)
  if (!parts.length) return
  return parts.reduce((acc, n) => (n >= 100 ? (acc || 1) * n : acc + n), 0)
}

function extractLanguages(t: string): Language[] {
  const out: Language[] = []
  if (has(t, 'english') || !has(t, 'spanish')) out.push('English')
  if (has(t, 'spanish', 'español', 'espanol')) out.push('Spanish')
  if (has(t, 'other', 'mandarin', 'vietnamese', 'russian', 'arabic', 'creole', 'portuguese', 'korean', 'more')) out.push('Other')
  return out
}

const SPECIALTIES: [RegExp, string][] = [
  [/derm/, 'Dermatology'],
  [/ob[\s-]?gyn|obstetric|gynecolog|women'?s health/, 'OB-GYN'],
  [/\bgi\b|gastro/, 'Gastroenterology'],
  [/ortho/, 'Orthopedics'],
  [/cardio/, 'Cardiology'],
  [/pediatric|peds/, 'Pediatrics'],
  [/primary care|family medicine|internal medicine/, 'Primary care'],
  [/ophthal|eye/, 'Ophthalmology'],
  [/dental|dentist/, 'Dental'],
  [/urolog/, 'Urology'],
  [/ent\b|otolaryng/, 'ENT'],
  [/physical therapy|\bpt\b/, 'Physical therapy'],
]

function extractIntro(raw: string, t: string): Partial<Profile> {
  const out: Partial<Profile> = {}
  const name = raw.match(/(?:I'?m|I am|my name is|this is)\s+([A-Z][a-z]+)/)
  if (name) out.name = name[1]
  const practice =
    raw.match(/(?:at|from|run|called|of|we're|we are)\s+((?:[A-Z][\w'&.-]*\s?){1,4}(?:Dermatology|Health|Medical|Medicine|Clinic|Associates|Group|Gastroenterology|Pediatrics|Orthopedics|Care|Partners|Practice|Center|Women's Health|GI|OB-GYN|OBGYN))/) ??
    raw.match(/((?:[A-Z][\w'&.-]*\s){1,3}(?:Dermatology|Health|Medical|Clinic|Associates|Group|Gastroenterology|Partners|Center))/)
  if (practice) out.practice = practice[1].trim()
  const spec = SPECIALTIES.find(([re]) => re.test(t))
  if (spec) out.specialty = spec[1]
  const providers = extractNumber(t, /(\d+|[a-z-]+(?:\s[a-z-]+)?)\s+(?:providers|doctors|physicians|docs|clinicians)/)
  if (providers) out.providers = providers
  return out
}

function extractWarmth(raw: string): Partial<Profile> {
  const sentences = raw.split(/(?<=[.!?])\s+/).filter(Boolean)
  const humanIdx = sentences.findIndex((s) => /human|person|someone|nurse|staff|real/i.test(s))
  const humanRule = humanIdx >= 0 ? sentences[humanIdx] : undefined
  const greeting = sentences.filter((_, i) => i !== humanIdx).join(' ') || raw
  return {
    greetingStyle: greeting,
    humanRule: humanRule ?? 'Whenever a patient asks for one',
    humanTrigger: humanRule ? undefined : "you'd rather talk to someone",
    toneNotes: /calm|unhurried|patient|slow/i.test(raw) ? 'Calm, unhurried pace' : 'Warm, uses the patient\'s name',
  }
}

// Deterministic variety, so the line can be fetched before the user finishes talking.
const vary = (p: Profile, lines: string[]) => lines[(p.name?.length ?? 0) % lines.length]

const lowerSpecialty = (s: string) => (/^[A-Z]{2,}|-/.test(s) ? s : s.toLowerCase())

// Spoken acknowledgements are built from the profile, and only from details that survive
// speech recognition well (specialty, size, EHR, call types), never the practice name.
export function ackFor(step: StepId, p: Profile): string {
  const you = p.name ? `, ${p.name}` : ''
  switch (step) {
    case 'intro': {
      const size = p.providers ? `${p.providers}-provider ` : ''
      const spec = p.specialty ? `${lowerSpecialty(p.specialty)} ` : ''
      const ehr = p.ehr && p.ehr !== 'Other' ? ` on ${p.ehr}` : ''
      const desc = size || spec || ehr ? `A ${size}${spec}practice${ehr}` : 'Your practice'
      return vary(p, [`Great to meet you${you}. ${desc}, got it.`, `Thanks${you}. ${desc}, perfect.`])
    }
    case 'calls': {
      const labels = CALL_TYPES.filter((c) => p.callTypes.includes(c.id)).map((c) => c.label.toLowerCase())
      const worst = p.painTimes.length ? `, worst ${joinList(p.painTimes)}` : ''
      const names = teamFor(p.callTypes).map((id) => AGENTS[id].name)
      const joining = names.length === 1 ? `${names[0]} is joining your team.` : `${joinList(names)} are joining your team.`
      return `${capitalize(joinList(labels))}${worst}. ${joining}`
    }
    case 'warmth':
      return vary(p, [
        "I love that. It's written into how every agent talks, and the human handoff rule is locked in.",
        "That's the heart of it. Every agent will greet patients that way and know when to hand off.",
      ])
    case 'book':
      return 'Thank you.'
    default:
      return ''
  }
}

const capitalize = (s: string) => s.replace(/^./, (c) => c.toUpperCase())

function joinList(xs: string[]) {
  if (xs.length <= 1) return xs.join('')
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

export function localTurn(step: StepId, raw: string): TurnResult {
  const t = raw.toLowerCase()
  const result = (slots: Partial<Profile>, advance = true, clarify?: string): TurnResult => ({ slots, advance, clarify })

  switch (step) {
    case 'intro': {
      const s = { ...extractIntro(raw, t), ...(extractEhr(t) ? { ehr: extractEhr(t) } : {}) }
      return s.practice || s.specialty ? result(s) : result(s, false, "Sorry, I didn't catch your practice. What's it called, and what's your specialty?")
    }
    case 'calls': {
      const callTypes = extractCallTypes(t)
      const painTimes = extractPain(t)
      const callsPerDay = extractNumber(t, /(\d[\d,]*|[a-z]+(?:[\s-][a-z]+){0,2})\s+calls/)
      const slots = { callTypes, painTimes, callsPerDay }
      return callTypes.length ? result(slots) : result(slots, false, 'Which ones come up most? Scheduling, billing, benefits, prior auth, reminders or claims?')
    }
    case 'warmth':
      return result({ ...extractWarmth(raw), languages: extractLanguages(t) })
    case 'tour': {
      const agent = Object.keys(AGENTS).find((a) => t.includes(a))
      const yes = /\b(yes|yeah|sure|play|hear|ok|okay|go ahead)\b/.test(t) && !/\bno\b/.test(t)
      return { slots: {}, advance: true, playSample: agent ?? (yes ? 'auto' : undefined) }
    }
    case 'book': {
      const email = raw.replace(/\s+at\s+/i, '@').replace(/\s+dot\s+/gi, '.').match(/[\w.+-]+@[\w-]+\.[\w.]+/)
      const role = raw.match(/(?:I'?m|I am)\s+(?:the\s+|a\s+|an\s+)?([a-zA-Z ]+?)(?:[.,]|$)/)
      const slots: Partial<Profile> = {}
      if (email) slots.email = email[0].toLowerCase().replace(/\.$/, '')
      if (role) slots.role = capitalize(role[1].trim())
      return slots.email ? result(slots) : result(slots, false, "Sorry, what's the best email for you?")
    }
    case 'confirm': {
      const yes = /\b(yes|yeah|sure|send|go ahead|please|do it)\b/.test(t) && !/\b(no|not yet|wait)\b/.test(t)
      return yes ? result({}) : result({}, false, "No problem. Edit anything on the right, and tell me when it's ready.")
    }
    default:
      return result({})
  }
}
