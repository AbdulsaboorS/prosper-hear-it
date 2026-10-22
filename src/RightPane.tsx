import { AGENTS, CALL_TYPES, greetingScript, teamFor, type AgentId, type Profile, type SampleLine } from './data'
import { STEPS, stepIndex, type StepId, type View } from './flow'

export type BookField = 'name' | 'practice' | 'specialty' | 'providers' | 'ehr' | 'volume' | 'team' | 'warmth'

interface Props {
  profile: Profile
  step: StepId
  view: View
  onView: (v: View) => void
  highlight: AgentId | null
  sample: { agent: AgentId; lines: SampleLine[]; index: number } | null
  warm: boolean
  onWarm: (w: boolean) => void
  onHear: () => void
  filled: BookField[]
  submitted: boolean
  onRestart: () => void
  onEditField: (patch: Partial<Profile>) => void
}

const TABS: { id: View; label: string }[] = [
  { id: 'setup', label: 'Live setup' },
  { id: 'team', label: 'Your AI team' },
  { id: 'greeting', label: 'Your agent' },
  { id: 'book', label: 'Kickoff' },
]

export function RightPane(props: Props) {
  const { profile, step, view } = props
  const question = Math.min(STEPS.find((s) => s.id === step)?.question ?? 6, 6)
  const pastQuestions = stepIndex(step) >= stepIndex('tour')
  const pct = configured(profile, props.submitted)

  return (
    <section className="pane card">
      <div className="pane-top">
        <div className="progress">
          <div className="progress-label">
            <span>{pastQuestions ? 'Onboarding complete' : `Step ${question} of 6`}</span>
            <strong>{pct}% configured</strong>
          </div>
          <div className="bar"><div style={{ width: `${pct}%` }} /></div>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={view === t.id ? 'on' : ''} onClick={() => props.onView(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="pane-body" key={view}>
        {view === 'setup' && <SetupView profile={profile} highlight={props.highlight} />}
        {view === 'team' && <TeamView profile={profile} highlight={props.highlight} sample={props.sample} />}
        {view === 'greeting' && <GreetingView {...props} />}
        {view === 'book' && <BookView {...props} />}
      </div>
    </section>
  )
}

function configured(p: Profile, submitted: boolean) {
  if (submitted) return 100
  const checks = [
    !!p.practice, !!p.specialty, p.callTypes.length > 0, !!p.ehr, p.painTimes.length > 0,
    !!p.callsPerDay, !!p.greetingStyle, !!p.humanRule, p.languages.length > 0,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 90)
}

function Field({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className={`field ${value ? 'set' : ''}`}>
      <span>{label}</span>
      <strong key={String(value)}>{value || '—'}</strong>
    </div>
  )
}

function SetupView({ profile: p, highlight }: { profile: Profile; highlight: AgentId | null }) {
  const team = teamFor(p.callTypes)
  return (
    <div className="setup">
      <div className="practice">
        <div className="practice-head">
          <div className="practice-avatar">{(p.practice ?? '?').slice(0, 1)}</div>
          <div>
            <h3>{p.practice ?? 'Your practice'}</h3>
            <p className="muted">{[p.specialty, p.providers && `${p.providers} providers`].filter(Boolean).join(' · ') || 'Tell Prosper Guide about your practice'}</p>
          </div>
        </div>
        <div className="fields">
          <Field label="Contact" value={p.name} />
          <Field label="EHR" value={p.ehr} />
          <Field label="Calls / day" value={p.callsPerDay?.toLocaleString()} />
          <Field label="Hardest hours" value={p.painTimes.join(', ')} />
          <Field label="Languages" value={p.languages.join(', ')} />
          <Field label="Call types" value={CALL_TYPES.filter((c) => p.callTypes.includes(c.id)).map((c) => c.label).join(', ')} />
        </div>
      </div>

      <h4 className="section-title">Your AI team <span className="muted">{team.length ? `${team.length} agents` : 'assembles as you talk'}</span></h4>
      <div className="team-grid">
        {team.length === 0 && <div className="empty">Agents appear here as you describe your calls.</div>}
        {team.map((id, i) => (
          <AgentCard key={id} id={id} delay={i * 90} active={highlight === id} compact />
        ))}
      </div>

      <h4 className="section-title">Warmth settings</h4>
      <div className="warmth">
        <Field label="Greeting style" value={p.greetingStyle} />
        <Field label="Always offer a human when" value={p.humanRule} />
        <Field label="Tone" value={p.toneNotes} />
      </div>
    </div>
  )
}

function AgentCard({ id, delay = 0, active, compact }: { id: AgentId; delay?: number; active?: boolean; compact?: boolean }) {
  const a = AGENTS[id]
  return (
    <div className={`agent ${active ? 'active' : ''} ${compact ? 'compact' : ''}`} style={{ animationDelay: `${delay}ms` }}>
      <div className={`avatar av-${id}`}>{a.name[0]}</div>
      <div>
        <strong>{a.name}</strong>
        <span>{a.role}</span>
        {!compact && <p>{a.blurb}</p>}
      </div>
    </div>
  )
}

function TeamView({ profile, highlight, sample }: { profile: Profile; highlight: AgentId | null; sample: Props['sample'] }) {
  const team = teamFor(profile.callTypes)
  return (
    <div className="teamview">
      <h3>{profile.practice ? `${profile.practice}'s AI team` : 'Your AI team'}</h3>
      <p className="muted">Each agent runs one workflow end to end, in {profile.ehr ?? 'your EHR'}, 24/7.</p>
      <div className="team-list">
        {team.length === 0 && <div className="empty">Tell Prosper Guide which calls take up your day.</div>}
        {team.map((id, i) => <AgentCard key={id} id={id} delay={i * 120} active={highlight === id} />)}
      </div>
      {sample && (
        <div className="sample">
          <div className="sample-head">
            <span className="live-dot" /> Sample call · {AGENTS[sample.agent].name}
            <span className="muted"> · illustrative script</span>
          </div>
          {sample.lines.slice(0, sample.index + 1).map((l, i) => (
            <div key={i} className={`line line-${l.who} ${i === sample.index ? 'now' : ''}`}>
              <span>{l.who === 'agent' ? AGENTS[sample.agent].name : sample.agent === 'kate' || sample.agent === 'alex' ? 'Payer rep' : 'Patient'}</span>
              {l.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const WEEKS = [
  { week: 'Week 1', title: 'Guidelines', text: 'Your Agent Manager turns your warmth rules and workflows into agent guidelines and connects your EHR.' },
  { week: 'Week 2', title: 'Test', text: 'Your team calls the agents, listens to test calls and tunes the scripts.' },
  { week: 'Week 3', title: 'Live', text: 'Agents start answering, starting with your hardest hours.' },
]

function GreetingView(props: Props) {
  const { profile, warm } = props
  return (
    <div className="greeting">
      <div className="ready-banner">
        <strong>Your team is configured.</strong> {teamFor(profile.callTypes).length || 1} agents ready for {profile.practice ?? 'your practice'}.
      </div>

      <div className="script-card">
        <div className="script-head">
          <div>
            <div className="eyebrow">Sample greeting · Anna, Appointment Scheduling</div>
            <h3>{warm ? 'How your agent sounds' : 'How most phone bots sound'}</h3>
          </div>
          <div className="toggle" role="group" aria-label="Script style">
            <button className={!warm ? 'on cold' : ''} onClick={() => props.onWarm(false)}>Cold</button>
            <button className={warm ? 'on' : ''} onClick={() => props.onWarm(true)}>Warm</button>
          </div>
        </div>
        <blockquote className={warm ? 'warm' : 'cold'}>{greetingScript(profile, warm)}</blockquote>
        {warm ? (
          <ul className="why">
            <li>Uses the patient's name</li>
            <li>Acknowledges the worry</li>
            <li>Explains why it's asking</li>
            <li>Offers a human{profile.humanRule ? `: ${profile.humanRule.replace(/\.$/, '').toLowerCase()}` : ''}</li>
          </ul>
        ) : (
          <ul className="why cold">
            <li>Menu-speak</li><li>No name</li><li>No reason given</li><li>No way to a person</li>
          </ul>
        )}
        <button className="primary" onClick={props.onHear}>▶ Hear your agent</button>
      </div>

      <GoLive />
    </div>
  )
}

function GoLive() {
  return (
    <div className="golive">
      <h4 className="section-title">Your path to live <span className="muted">typical 3-week launch</span></h4>
      <div className="weeks">
        {WEEKS.map((w) => (
          <div key={w.week} className="week">
            <span className="eyebrow">{w.week}</span>
            <strong>{w.title}</strong>
            <p>{w.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function BookView(props: Props) {
  const { profile: p, filled, submitted } = props
  const team = teamFor(p.callTypes)
  const show = (f: BookField) => filled.includes(f) || submitted
  const brief = [
    `Practice: ${p.practice ?? ''} (${p.specialty ?? ''}${p.providers ? `, ${p.providers} providers` : ''})`,
    `Contact: ${p.name ?? ''}${p.role ? `, ${p.role}` : ''} <${p.email ?? ''}>`,
    `EHR: ${p.ehr ?? ''}`,
    `Volume: ${p.callsPerDay ? `${p.callsPerDay} calls/day, ` : ''}worst ${p.painTimes.join(', ')}`,
    `Agents: ${team.map((id) => `${AGENTS[id].name} (${AGENTS[id].role})`).join(', ')}`,
    `Languages: ${p.languages.join(', ')}`,
    `Warmth: ${p.greetingStyle ?? ''} Human handoff: ${p.humanRule ?? ''}`,
  ].join('\n')

  if (submitted) {
    return (
      <div className="book">
        <div className="sent">
          <div className="check">✓</div>
          <h3>Kickoff requested</h3>
          <p>An Agent Manager will reach out to {p.email ?? 'you'} within a business day to start Week 1.</p>
          <p className="muted small">Prototype: nothing was actually sent.</p>
        </div>
        <GoLive />
        <div className="actions">
          <a className="primary" href="https://www.getprosper.ai/get-started" target="_blank" rel="noreferrer">Open Prosper's real Get Started →</a>
          <button className="ghost" onClick={() => navigator.clipboard.writeText(brief)}>Copy setup brief</button>
          <button className="ghost" onClick={props.onRestart}>Restart demo</button>
        </div>
      </div>
    )
  }

  const row = (f: BookField, label: string, value?: string | number) => (
    <label className={`form-row ${show(f) && value ? 'filled' : ''}`}>
      <span>{label}</span>
      <input readOnly value={show(f) ? value ?? '' : ''} placeholder=" " />
    </label>
  )

  return (
    <div className="book">
      <h3>Talk to the Prosper team</h3>
      <p className="muted">Filled in by Prosper Guide from your conversation.</p>
      <div className="form">
        {row('name', 'Name', p.name)}
        <label className={`form-row ${p.email ? 'filled' : ''}`}>
          <span>Work email</span>
          <input value={p.email ?? ''} onChange={(e) => props.onEditField({ email: e.target.value })} placeholder="Tell Prosper Guide" />
        </label>
        <label className={`form-row ${p.role ? 'filled' : ''}`}>
          <span>Role</span>
          <input value={p.role ?? ''} onChange={(e) => props.onEditField({ role: e.target.value })} placeholder="Tell Prosper Guide" />
        </label>
        {row('practice', 'Practice', p.practice)}
        {row('specialty', 'Specialty', [p.specialty, p.providers && `${p.providers} providers`].filter(Boolean).join(', '))}
        {row('ehr', 'EHR', p.ehr)}
        {row('volume', 'Call volume', [p.callsPerDay && `${p.callsPerDay.toLocaleString()}/day`, p.painTimes.length && `worst ${p.painTimes.join(', ')}`].filter(Boolean).join(', '))}
        {row('team', 'Agents needed', team.map((id) => AGENTS[id].name).join(', '))}
        {row('warmth', 'Human handoff rule', p.humanRule)}
      </div>
    </div>
  )
}
