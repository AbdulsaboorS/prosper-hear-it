export type AgentId =
  | 'anna' | 'emma' | 'ben' | 'tom' | 'jack' | 'alex' | 'kate' | 'mary' | 'lucy' | 'sara' | 'james'

export type CallType =
  | 'scheduling' | 'billing' | 'benefits' | 'priorAuth' | 'reminders'
  | 'switchboard' | 'claims' | 'refills' | 'recall'

export type Ehr = 'athenahealth' | 'ModMed' | 'eClinicalWorks' | 'Epic' | 'NextGen' | 'Other'
export type PainTime = 'mornings' | 'lunch' | 'after hours' | 'all day'
export type Language = 'English' | 'Spanish' | 'Other'

export interface Agent {
  id: AgentId
  name: string
  role: string
  blurb: string
  voice: string
}

export const AGENTS: Record<AgentId, Agent> = {
  anna: { id: 'anna', name: 'Anna', role: 'Appointment Scheduling', blurb: 'Books, reschedules and fills cancellations straight into your calendar.', voice: 'andromeda' },
  emma: { id: 'emma', name: 'Emma', role: 'Inbound Billing Questions', blurb: 'Explains statements and takes payments without a hold queue.', voice: 'helena' },
  ben: { id: 'ben', name: 'Ben', role: 'Patient Balance Reminders', blurb: 'Calls patients about open balances, kindly, and sets up payment.', voice: 'arcas' },
  tom: { id: 'tom', name: 'Tom', role: 'Appointment Reminders', blurb: 'Confirms tomorrow\'s visits and rebooks the ones that can\'t make it.', voice: 'apollo' },
  jack: { id: 'jack', name: 'Jack', role: 'Switchboard', blurb: 'Answers every line and routes callers to the right person.', voice: 'orion' },
  alex: { id: 'alex', name: 'Alex', role: 'Benefits Verification', blurb: 'Calls payers to verify coverage before the patient arrives.', voice: 'odysseus' },
  kate: { id: 'kate', name: 'Kate', role: 'Prior Authorization', blurb: 'Initiates and follows up on prior auths with payers.', voice: 'athena' },
  mary: { id: 'mary', name: 'Mary', role: 'Denial Follow-up', blurb: 'Gathers denial reasons from payers so appeals move fast.', voice: 'hera' },
  lucy: { id: 'lucy', name: 'Lucy', role: 'Claim Follow-up', blurb: 'Chases claims that haven\'t adjudicated and logs status in your EHR.', voice: 'luna' },
  sara: { id: 'sara', name: 'Sara', role: 'Re-Engagement Campaigns', blurb: 'Brings overdue patients back for recalls and follow-ups.', voice: 'asteria' },
  james: { id: 'james', name: 'James', role: 'Prescription Refills', blurb: 'Takes refill requests and routes them to the right provider.', voice: 'orpheus' },
}

export const CALL_TYPES: { id: CallType; label: string; agents: AgentId[] }[] = [
  { id: 'scheduling', label: 'Scheduling', agents: ['anna'] },
  { id: 'billing', label: 'Billing questions', agents: ['emma', 'ben'] },
  { id: 'benefits', label: 'Benefits verification', agents: ['alex'] },
  { id: 'priorAuth', label: 'Prior auth', agents: ['kate'] },
  { id: 'reminders', label: 'Reminders', agents: ['tom'] },
  { id: 'switchboard', label: 'Switchboard', agents: ['jack'] },
  { id: 'claims', label: 'Claims & denials', agents: ['lucy', 'mary'] },
  { id: 'refills', label: 'Refills', agents: ['james'] },
  { id: 'recall', label: 'Recalls', agents: ['sara'] },
]

export const EHRS: Ehr[] = ['athenahealth', 'ModMed', 'eClinicalWorks', 'Epic', 'NextGen', 'Other']
export const PAIN_TIMES: PainTime[] = ['mornings', 'lunch', 'after hours', 'all day']
export const LANGUAGES: Language[] = ['English', 'Spanish', 'Other']

export interface Profile {
  name?: string
  practice?: string
  specialty?: string
  providers?: number
  callTypes: CallType[]
  ehr?: Ehr
  painTimes: PainTime[]
  callsPerDay?: number
  greetingStyle?: string
  humanRule?: string
  // Second-person clause for scripts, e.g. "you're worried about a biopsy result"
  humanTrigger?: string
  toneNotes?: string
  languages: Language[]
  email?: string
  role?: string
}

export const emptyProfile = (): Profile => ({ callTypes: [], painTimes: [], languages: [] })

export function teamFor(callTypes: CallType[]): AgentId[] {
  const ids = CALL_TYPES.filter((c) => callTypes.includes(c.id)).flatMap((c) => c.agents)
  return [...new Set(ids)]
}

// One scripted reply per turn, in flow order (see STEPS in flow.ts).
export interface Preset {
  id: string
  label: string
  detail: string
  lines: string[]
}

export const PRESETS: Preset[] = [
  {
    id: 'derm',
    label: 'Dermatology group',
    detail: '12 providers · ModMed · after-hours pain',
    lines: [
      "Hi, I'm Priya, I run operations at Lakeside Dermatology. We have 12 providers and we're on ModMed.",
      'Scheduling, benefits checks and prior auths. Prior auths for biologics are killing us, and after hours is the worst. Around 600 calls a day.',
      "We greet everyone by name and tell them we're glad they called. Anyone anxious about a biopsy result should always get a human. English and Spanish.",
      'Sure, play Kate.',
      "priya@lakesidederm.com, I'm the director of operations.",
      'Yes, send it.',
    ],
  },
  {
    id: 'obgyn',
    label: 'OBGYN group',
    detail: '8 providers · eClinicalWorks · morning pain',
    lines: [
      "This is Dana, practice manager at Harbor Women's Health. We're an OB-GYN group, 8 providers, on eClinicalWorks.",
      'Mostly scheduling and billing questions. Mornings are brutal, about 400 calls a day.',
      "Warm and unhurried, a lot of our patients are expecting for the first time. Anyone mentioning bleeding or pain goes to a nurse immediately. English and Spanish.",
      'Yes, let me hear Anna.',
      "dana@harborwomens.com, I'm the practice manager.",
      'Yes please.',
    ],
  },
  {
    id: 'gi',
    label: 'GI practice',
    detail: '20 providers · athenahealth · all-day pain',
    lines: [
      "I'm Marcus, COO of Summit Gastroenterology. 20 providers, and we run athenahealth.",
      "Scheduling, prior authorizations, and claims follow-up. It's all day, honestly, over a thousand calls a day.",
      'Calm and clear, a lot of people are nervous about colonoscopy prep. Anyone confused about prep instructions should always be offered a person. Just English.',
      'No, I think I get it.',
      "marcus@summitgi.com, I'm the COO.",
      'Go ahead and send it.',
    ],
  },
]

export interface SampleLine {
  who: 'agent' | 'patient'
  text: string
}

export function sampleCall(id: AgentId, practice: string): SampleLine[] {
  const p = practice || 'the practice'
  const scripts: Partial<Record<AgentId, SampleLine[]>> = {
    anna: [
      { who: 'agent', text: `Thanks for calling ${p}, this is Anna. How can I help today?` },
      { who: 'patient', text: 'Hi, I need to move my appointment on Thursday.' },
      { who: 'agent', text: 'Of course. I see you with Doctor Lee Thursday at ten. Would next Monday at nine work instead?' },
      { who: 'patient', text: 'Monday works.' },
      { who: 'agent', text: "You're all set for Monday at nine. I'll text you a confirmation. Anything else I can do for you?" },
    ],
    kate: [
      { who: 'agent', text: `Hi, this is Kate calling from ${p} about a prior authorization for a patient.` },
      { who: 'patient', text: 'Sure, what is the member ID?' },
      { who: 'agent', text: "It's on file under the reference I sent this morning. We're requesting approval for the biologic Doctor Patel prescribed. Can you tell me what's still needed?" },
      { who: 'patient', text: 'We just need the last chart note. Then it goes to review.' },
      { who: 'agent', text: "Perfect, I'll fax that over now and call back Thursday to check the status. Thank you so much." },
    ],
    alex: [
      { who: 'agent', text: `Hi, this is Alex from ${p}, calling to verify benefits for an upcoming visit.` },
      { who: 'patient', text: 'Go ahead.' },
      { who: 'agent', text: 'Can you confirm the specialist copay and whether the deductible has been met this year?' },
      { who: 'patient', text: "Forty dollar copay. Deductible's met." },
      { who: 'agent', text: "Great, I'll note that in the chart so the patient knows what to expect. Thank you." },
    ],
    emma: [
      { who: 'agent', text: `Thanks for calling ${p} billing, this is Emma.` },
      { who: 'patient', text: "I got a bill and I don't understand why I owe anything." },
      { who: 'agent', text: "I completely understand, these can be confusing. Your insurance covered most of the visit, and the eighty dollars left is your annual deductible. Would it help if I set up a payment plan?" },
      { who: 'patient', text: 'Yes, that would help.' },
      { who: 'agent', text: "Done. Four payments of twenty dollars, starting next month. I'll text you the details." },
    ],
  }
  return scripts[id] ?? [
    { who: 'agent', text: `Hi, this is ${AGENTS[id].name} from ${p}.` },
    { who: 'agent', text: `I handle ${AGENTS[id].role.toLowerCase()}, so your team can focus on the patients in front of them.` },
  ]
}

export function greetingScript(profile: Profile, warm: boolean): string {
  const practice = profile.practice || 'your practice'
  if (!warm) {
    return `Thank you for calling ${practice}. Please state the reason for your call. For scheduling, say scheduling. For billing, say billing. Please hold while I process your request.`
  }
  const human = profile.humanTrigger
    ? ` And if ${profile.humanTrigger.replace(/\.$/, '')}, I'll get you to someone on our team right away.`
    : " And if you'd rather talk to someone on our team, just say so and I'll connect you."
  const spanish = profile.languages.includes('Spanish') ? ' También puedo ayudarle en español.' : ''
  return `Hi Maria, thanks for calling ${practice}, this is Anna. I see you're due for your follow-up. I know rescheduling can be stressful, so let's find a time that actually works for you. I'll ask a couple of quick questions so your visit goes smoothly.${human}${spanish}`
}
