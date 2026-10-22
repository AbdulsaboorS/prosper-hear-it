interface Env {
  AI: Ai
}

interface TurnRequest {
  step: string
  question: string
  utterance: string
  profile: Record<string, unknown>
}

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

const CALL_TYPES = ['scheduling', 'billing', 'benefits', 'priorAuth', 'reminders', 'switchboard', 'claims', 'refills', 'recall']
const AGENTS = ['anna', 'emma', 'ben', 'tom', 'jack', 'alex', 'kate', 'mary', 'lucy', 'sara', 'james']

// Per step: which profile fields the model may fill, and when it may move on.
const STEP_FIELDS: Record<string, { fields: Record<string, unknown>; rule: string; required?: string[] }> = {
  intro: {
    fields: {
      name: { type: 'string', description: "The speaker's first name" },
      practice: { type: 'string', description: 'Practice name, properly capitalized' },
      specialty: { type: 'string', description: 'Medical specialty, title case, e.g. Dermatology, OB-GYN, Gastroenterology' },
      providers: { type: 'integer', description: 'Number of providers, if mentioned' },
      ehr: { type: 'string', enum: ['athenahealth', 'ModMed', 'eClinicalWorks', 'Epic', 'NextGen', 'Other'], description: 'Their EHR, if mentioned; any unlisted EHR is "Other"' },
    },
    rule: 'Extract every field they mention, including their first name ("I\'m Abdul" -> name "Abdul"). advance=true once practice or specialty is known. If both are missing, advance=false.',
  },
  calls: {
    fields: {
      callTypes: { type: 'array', items: { type: 'string', enum: CALL_TYPES } },
      painTimes: { type: 'array', items: { type: 'string', enum: ['mornings', 'lunch', 'after hours', 'all day'] } },
      callsPerDay: { type: 'integer', description: 'Calls per day, if mentioned ("over a thousand" -> 1000)' },
    },
    rule: 'Map what they describe onto callTypes ("prior auths" -> priorAuth, "claims", "denials" -> claims, "insurance verification" -> benefits, "phones ringing off the hook / routing" -> switchboard). Also capture when it hurts most and call volume if mentioned. advance=true if at least one call type.',
  },
  warmth: {
    fields: {
      greetingStyle: { type: 'string', description: 'How they welcome patients, under 12 words, e.g. "Greets by name, says glad you called"' },
      humanRule: { type: 'string', description: 'When a patient must be offered a human, under 12 words, e.g. "Anxious about biopsy results"' },
      humanTrigger: { type: 'string', description: 'The same rule as a second-person clause that completes "And if ___, I\'ll get you to someone on our team right away", e.g. "you\'re worried about a biopsy result"' },
      toneNotes: { type: 'string', description: 'Tone guidance for the agents, under 8 words' },
      languages: { type: 'array', items: { type: 'string', enum: ['English', 'Spanish', 'Other'] }, description: 'Languages needed; default ["English"]' },
    },
    rule: 'Always advance=true. Fill every field, inferring sensible values from whatever they said.',
    required: ['greetingStyle', 'humanRule', 'humanTrigger', 'toneNotes', 'languages'],
  },
  tour: {
    fields: {},
    rule: `They were asked whether they want to hear a sample call from one of their agents. Set playSample to an agent id from ${AGENTS.join(', ')} if they named one, "auto" if they said yes without naming one, or "none" if they declined. Always advance=true.`,
  },
  book: {
    fields: {
      email: { type: 'string', description: 'Email address, normalized from speech ("dana at harbor dot com" -> dana@harbor.com), lowercase' },
      role: { type: 'string', description: 'Job title, title case' },
    },
    rule: 'advance=true if an email is known.',
  },
  confirm: {
    fields: {},
    rule: 'They were asked whether to send their kickoff request. advance=true if they agree. If they hesitate, advance=false and reassure them they can edit anything first.',
  },
}

const SYSTEM = `You understand replies in a voice onboarding call between Prosper AI (AI voice agents for healthcare practices) and a practice leader.
Each turn you get the question that was asked and what they said back (from speech recognition, so expect transcription errors and fix them, e.g. capitalize practice names).
Return JSON only:
- slots: fields you can extract for this step (omit unknown ones, never invent)
- advance: whether this step is complete
- clarify: only when advance=false, one short spoken question asking for what is missing, warm and natural; otherwise ""
- playSample: only for the tour step`

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json()) as TurnRequest
  const spec = STEP_FIELDS[body.step]
  if (!spec) return Response.json({ error: 'unknown step' }, { status: 400 })

  const schema = {
    type: 'object',
    properties: {
      slots: { type: 'object', properties: spec.fields, ...(spec.required ? { required: spec.required } : {}) },
      advance: { type: 'boolean' },
      clarify: { type: 'string' },
      playSample: { type: 'string' },
    },
    required: ['slots', 'advance'],
  }

  const user = `Step: ${body.step}
Rule for this step: ${spec.rule}
What we know so far: ${JSON.stringify(body.profile)}
You asked: "${body.question}"
They said: "${body.utterance}"`

  const res = (await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_schema', json_schema: schema },
    max_tokens: 300,
    temperature: 0.6,
  } as never)) as unknown as { response: unknown }

  const out = typeof res.response === 'string' ? JSON.parse(res.response) : res.response
  return Response.json(out)
}
