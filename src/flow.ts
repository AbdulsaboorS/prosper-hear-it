import {
  CALL_TYPES, EHRS, type CallType, type Ehr, type Language, type PainTime, type Profile,
} from './data'

export type StepId =
  | 'intro' | 'calls' | 'ehr' | 'volume' | 'warmth' | 'languages' | 'tour' | 'book' | 'confirm' | 'done'

export type View = 'setup' | 'team' | 'greeting' | 'book'

export interface Step {
  id: StepId
  view: View
  // Index into the six onboarding questions, for the progress bar.
  question?: number
  ask: (p: Profile) => string
  quickReplies?: string[]
  multi?: boolean
}

const first = (p: Profile) => (p.name ? `, ${p.name}` : '')

export const STEPS: Step[] = [
  {
    id: 'intro', view: 'setup', question: 1,
    ask: () =>
      "Hi, I'm your Prosper Guide. In about three minutes I'll set up an AI front desk team for your practice, just by talking. To start, what's your name, and tell me about your practice and specialty?",
  },
  {
    id: 'calls', view: 'setup', question: 2, multi: true,
    ask: () => 'Which calls eat up most of your front desk\'s day? Scheduling, billing, benefits, prior auth, reminders, the switchboard, claims? Name as many as you like.',
    quickReplies: CALL_TYPES.map((c) => c.label),
  },
  {
    id: 'ehr', view: 'setup', question: 3,
    ask: () => 'Which EHR do you run? Prosper reads and writes to it directly, so nobody re-types anything.',
    quickReplies: [...EHRS],
  },
  {
    id: 'volume', view: 'setup', question: 4,
    ask: () => 'When do the phones hurt the most, and roughly how many calls do you get a day?',
    quickReplies: ['Mornings', 'Lunch', 'After hours', 'All day'],
  },
  {
    id: 'warmth', view: 'setup', question: 5,
    ask: (p) =>
      `This one matters most to me${first(p)}. How does your front desk make patients feel welcome, and when should a patient always be offered a real person?`,
    quickReplies: ['Greet by name, never rush them. Anyone upset gets a human.'],
  },
  {
    id: 'languages', view: 'setup', question: 6,
    ask: () => 'Last one. Which languages do your patients need?',
    quickReplies: ['English', 'English and Spanish', 'English, Spanish and others'],
  },
  {
    id: 'tour', view: 'team',
    ask: () => '',
    quickReplies: ['Play a sample call', 'No thanks, keep going'],
  },
  {
    id: 'book', view: 'book',
    ask: () => '',
  },
  {
    id: 'confirm', view: 'book',
    ask: () => 'Everything look right? Want me to send it to our team?',
    quickReplies: ['Yes, send it', 'Not yet'],
  },
  { id: 'done', view: 'book', ask: () => '' },
]

export const stepIndex = (id: StepId) => STEPS.findIndex((s) => s.id === id)
export const nextStep = (id: StepId): StepId => STEPS[Math.min(stepIndex(id) + 1, STEPS.length - 1)].id

// What the brain hands back for one user turn. The LLM fills this in;
// `localTurn` below is the keyword fallback with the same shape.
export interface TurnResult {
  slots: Partial<Profile>
  ack: string
  advance: boolean
  playSample?: string
  source: 'llm' | 'local'
}

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

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
  const name = raw.match(/(?:I'?m|I am|my name is|this is|it's)\s+([A-Z][a-z]+)/)
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

const ACKS = {
  intro: (p: Partial<Profile>) => [
    `Lovely to meet you${p.name ? `, ${p.name}` : ''}. ${p.practice ?? 'Your practice'}${p.specialty ? `, ${p.specialty.toLowerCase()}` : ''}${p.providers ? ` with ${p.providers} providers` : ''}. Got it.`,
    `Thanks${p.name ? `, ${p.name}` : ''}. So that's ${p.practice ?? 'your practice'}${p.providers ? `, ${p.providers} providers` : ''}. I've started your practice card on the right.`,
  ],
  calls: (labels: string) => [
    `${labels}. That's a lot of phone time, and every one of those has an agent built for it. Watch them join your team.`,
    `Okay, ${labels}. I'm adding the right agents for each of those now.`,
  ],
  ehr: (ehr: string) => [`${ehr}, perfect. That's a well-worn path for us.`, `Great, ${ehr}. Your agents will read and write to it directly.`],
  volume: (when: string, n?: number) => [
    `${when}${n ? `, around ${n.toLocaleString()} calls a day` : ''}. That's exactly when patients end up on hold, so that's where your agents will start.`,
    `Got it, ${when} is the crunch${n ? ` with about ${n.toLocaleString()} calls a day` : ''}. No more hold music during that window.`,
  ],
  warmth: () => [
    "I love that. I've written that into how every one of your agents talks, and the rule about a real person is locked in.",
    "That's the heart of it. Your agents will greet patients that way, and they'll always know when to hand off to your team.",
  ],
  languages: (langs: string) => [`${langs}, done.`, `Perfect, ${langs}.`],
}

function joinList(xs: string[]) {
  if (xs.length <= 1) return xs.join('')
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

export function localTurn(step: StepId, raw: string, profile: Profile): TurnResult {
  const t = raw.toLowerCase()
  const result = (slots: Partial<Profile>, ack: string, advance = true): TurnResult => ({
    slots, ack, advance, source: 'local',
  })

  switch (step) {
    case 'intro': {
      const s = extractIntro(raw, t)
      if (!s.practice && !s.specialty) return result(s, "Sorry, I didn't catch your practice. What's it called, and what's your specialty?", false)
      return result(s, pick(ACKS.intro({ ...profile, ...s })))
    }
    case 'calls': {
      const callTypes = extractCallTypes(t)
      if (!callTypes.length) return result({}, 'Which ones come up most? Scheduling, billing, benefits, prior auth, reminders, switchboard or claims?', false)
      const labels = CALL_TYPES.filter((c) => callTypes.includes(c.id)).map((c) => c.label.toLowerCase())
      return result({ callTypes }, pick(ACKS.calls(joinList(labels).replace(/^./, (c) => c.toUpperCase()))))
    }
    case 'ehr': {
      const ehr = extractEhr(t)
      if (!ehr) return result({}, 'Which one is it? athenahealth, ModMed, eClinicalWorks, Epic, NextGen, or something else?', false)
      return result({ ehr }, pick(ACKS.ehr(ehr === 'Other' ? 'Okay' : ehr)))
    }
    case 'volume': {
      const painTimes = extractPain(t)
      const callsPerDay = extractNumber(t, /(\d[\d,]*|[a-z]+(?:[\s-][a-z]+){0,2})\s+calls/)
      if (!painTimes.length) return result({ callsPerDay }, 'And when is it worst? Mornings, lunch, after hours, or all day?', false)
      const when = joinList(painTimes).replace(/^./, (c) => c.toUpperCase())
      return result({ painTimes, callsPerDay }, pick(ACKS.volume(when, callsPerDay)))
    }
    case 'warmth':
      return result(extractWarmth(raw), pick(ACKS.warmth()))
    case 'languages': {
      const languages = extractLanguages(t)
      return result({ languages }, pick(ACKS.languages(joinList(languages))))
    }
    case 'tour': {
      const agent = ['anna', 'emma', 'kate', 'alex', 'ben', 'tom', 'jack', 'mary', 'lucy', 'sara', 'james'].find((a) => t.includes(a))
      const yes = /\b(yes|yeah|sure|play|hear|ok|okay|go ahead)\b/.test(t) && !/\bno\b/.test(t)
      return { slots: {}, ack: '', advance: true, playSample: agent ?? (yes ? 'auto' : undefined), source: 'local' }
    }
    case 'book': {
      const email = raw.replace(/\s+at\s+/i, '@').replace(/\s+dot\s+/gi, '.').match(/[\w.+-]+@[\w-]+\.[\w.]+/)
      const role = raw.match(/(?:I'?m|I am)\s+(?:the\s+|a\s+|an\s+)?([a-zA-Z ]+?)(?:[.,]|$)/)
      const slots: Partial<Profile> = {}
      if (email) slots.email = email[0].toLowerCase().replace(/\.$/, '')
      if (role) slots.role = role[1].trim().replace(/^./, (c) => c.toUpperCase())
      if (!slots.email) return result(slots, "Sorry, what's the best email for you?", false)
      return result(slots, 'Thank you. Your kickoff request is filled in on the right.')
    }
    case 'confirm': {
      const yes = /\b(yes|yeah|sure|send|go ahead|please|do it)\b/.test(t) && !/\b(no|not yet|wait)\b/.test(t)
      return yes ? result({}, '') : result({}, "No problem. Edit anything on the right, and tell me when it's ready.", false)
    }
    default:
      return result({}, '')
  }
}
