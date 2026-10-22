export type AgentId =
  | 'anna' | 'tom' | 'jack' | 'james' | 'sara' | 'emma' | 'ben' | 'alex' | 'kate' | 'lucy' | 'mary'

export interface Agent {
  id: AgentId
  name: string
  role: string
  blurb: string
  // Deepgram Aura-2 speaker.
  voice: string
  // Who is on the other end of the sample call.
  with: 'patient' | 'payer'
}

const agent = (id: AgentId, name: string, role: string, blurb: string, voice: string, withWho: Agent['with']): Agent =>
  ({ id, name, role, blurb, voice, with: withWho })

export const AGENTS: Agent[] = [
  agent('anna', 'Anna', 'Appointment Scheduling', 'Books, reschedules and fills cancellations.', 'andromeda', 'patient'),
  agent('tom', 'Tom', 'Appointment Reminders', 'Confirms visits and rebooks the ones that can\'t make it.', 'apollo', 'patient'),
  agent('jack', 'Jack', 'Switchboard', 'Answers every line and routes callers.', 'orion', 'patient'),
  agent('james', 'James', 'Prescription Refills', 'Takes refill requests and routes them to the provider.', 'orpheus', 'patient'),
  agent('sara', 'Sara', 'Re-Engagement Campaigns', 'Brings overdue patients back in.', 'asteria', 'patient'),
  agent('emma', 'Emma', 'Inbound Billing Questions', 'Explains bills and sets up payment plans.', 'helena', 'patient'),
  agent('ben', 'Ben', 'Patient Balance Reminders', 'Collects open balances, kindly.', 'arcas', 'patient'),
  agent('alex', 'Alex', 'Benefits Verification', 'Verifies coverage with payers before the visit.', 'odysseus', 'payer'),
  agent('kate', 'Kate', 'Prior Authorization', 'Initiates and follows up on prior auths.', 'athena', 'payer'),
  agent('lucy', 'Lucy', 'Claim Follow-up', 'Chases claims that haven\'t been decided.', 'luna', 'payer'),
  agent('mary', 'Mary', 'Denial Follow-up', 'Gets denial reasons so appeals move fast.', 'hera', 'payer'),
]

export const PATIENT_VOICE = 'aurora'
export const PAYER_VOICE = 'hermes'

// The specialty-specific details that make each sample call sound like the visitor's practice.
export interface Specialty {
  id: string
  label: string
  visit: string
  followup: string
  procedure: string
  medication: string
  // Completes "And if ___, I'll get you to someone on our team right away."
  human: string
}

export const SPECIALTIES: Specialty[] = [
  { id: 'derm', label: 'Dermatology', visit: 'skin check', followup: 'biopsy results', procedure: 'Mohs surgery', medication: 'a biologic for psoriasis', human: "you're worried about a biopsy result" },
  { id: 'obgyn', label: 'OB-GYN', visit: 'prenatal visit', followup: 'ultrasound results', procedure: 'ultrasound', medication: 'a fertility medication', human: "you're having any bleeding or pain" },
  { id: 'gi', label: 'Gastroenterology', visit: 'colonoscopy', followup: 'prep instructions', procedure: 'colonoscopy', medication: "a biologic for Crohn's", human: 'anything about your prep is confusing' },
  { id: 'ortho', label: 'Orthopedics', visit: 'knee follow-up', followup: 'MRI results', procedure: 'knee MRI', medication: 'a knee injection', human: "you're in a lot of pain" },
  { id: 'primary', label: 'Primary care', visit: 'annual physical', followup: 'lab results', procedure: 'sleep study', medication: 'a GLP-1 medication', human: 'something feels urgent' },
  { id: 'cardio', label: 'Cardiology', visit: 'heart checkup', followup: 'echo results', procedure: 'stress test', medication: 'a new heart medication', human: 'you have any chest pain' },
]

export interface Line {
  who: 'agent' | 'other'
  text: string
}

const a = (text: string): Line => ({ who: 'agent', text })
const o = (text: string): Line => ({ who: 'other', text })

export function sampleCall(id: AgentId, practice: string, s: Specialty): Line[] {
  const p = practice || 'your practice'
  switch (id) {
    case 'anna': return [
      a(`Thanks for calling ${p}, this is Anna. How can I help?`),
      o(`Hi, I need to move my ${s.visit} on Thursday.`),
      a('Of course. Doctor Lee has Monday at nine or Tuesday at two. Which works better for you?'),
      o('Monday, please.'),
      a("You're all set for Monday at nine. I'll text you a confirmation."),
    ]
    case 'tom': return [
      a(`Hi, this is Tom from ${p}, confirming your ${s.visit} tomorrow at ten with Doctor Lee.`),
      o("Oh no, I can't make it tomorrow."),
      a('No problem at all. I can move you to Thursday at ten, or Friday at one.'),
      o('Friday works.'),
      a('Friday at one it is. See you then.'),
    ]
    case 'jack': return [
      a(`Thank you for calling ${p}, this is Jack. How can I direct your call?`),
      o(`I have a question about my ${s.followup}.`),
      a("Got it. That's our nursing team. I'm connecting you now, and I've noted your question so you won't have to repeat it."),
    ]
    case 'james': return [
      a(`${p}, this is James. How can I help?`),
      o("I'm almost out of my prescription and need a refill."),
      a("Happy to help. I'm sending the request to Doctor Lee now, and you'll get a text when it's ready at your pharmacy."),
    ]
    case 'sara': return [
      a(`Hi, this is Sara from ${p}. It's been about a year since your last ${s.visit}, and Doctor Lee wanted to check in.`),
      o("Oh, I've been meaning to book that."),
      a('I can get you in next Wednesday at eleven. Want me to hold it for you?'),
      o('Yes, please.'),
    ]
    case 'emma': return [
      a(`${p} billing, this is Emma.`),
      o(`I got a bill after my ${s.visit} and I don't understand why I owe anything.`),
      a("That's a fair question, these can be confusing. Insurance covered most of it, and the eighty dollars left is your deductible. Want me to split it into four payments?"),
      o('Yes, that would help.'),
      a('Done. Twenty dollars a month, starting next month.'),
    ]
    case 'ben': return [
      a(`Hi, this is Ben from ${p}. I'm calling about a small balance from your ${s.visit}. Is now an okay time?`),
      o('Sure, how much is it?'),
      a("It's sixty-five dollars. I can take a card now, or text you a secure link."),
      o('Text me the link.'),
      a('Sent. Thanks so much, and no rush.'),
    ]
    case 'alex': return [
      a(`Hi, this is Alex calling from ${p} to verify benefits for an upcoming ${s.visit}.`),
      o('Sure, go ahead.'),
      a('Can you confirm the specialist copay, and whether the deductible has been met?'),
      o("Forty dollar copay, and the deductible's met."),
      a("Perfect. I'll note that so the patient knows what to expect."),
    ]
    case 'kate': return [
      a(`Hi, this is Kate from ${p}, following up on a prior authorization for ${s.medication}.`),
      o('I see it. We still need the latest chart note.'),
      a("I'll fax it over now and call back Thursday to check the status. Thank you."),
    ]
    case 'lucy': return [
      a(`Hi, this is Lucy from ${p}, checking on a claim for a ${s.procedure} from August.`),
      o("That claim's still in review."),
      a("Thanks. Is anything missing on our side, and when's the decision expected?"),
      o('Nothing missing. Decision by the thirtieth.'),
      a("Great, I'll log that in the chart."),
    ]
    case 'mary': return [
      a(`Hi, this is Mary from ${p}, calling about a denied claim for a ${s.procedure}.`),
      o('It was denied for missing medical necessity documentation.'),
      a("Understood. What's the appeal deadline, and where should we send the records?"),
      o('Sixty days, by fax.'),
      a("Thank you. I'll get the appeal started today."),
    ]
  }
}

export function greeting(practice: string, s: Specialty, warm: boolean): string {
  const p = practice || 'your practice'
  if (!warm) {
    return `Thank you for calling ${p}. Please state the reason for your call. For scheduling, say scheduling. For billing, say billing. Please hold while I process your request.`
  }
  return `Hi Maria, thanks for calling ${p}, this is Anna. I see you're due for your ${s.visit}. I know scheduling can be stressful, so let's find a time that actually works for you. And if ${s.human}, I'll get you to someone on our team right away.`
}

export const PRESETS: { practice: string; specialty: string }[] = [
  { practice: 'Lakeside Dermatology', specialty: 'derm' },
  { practice: "Harbor Women's Health", specialty: 'obgyn' },
  { practice: 'Summit Gastroenterology', specialty: 'gi' },
]
