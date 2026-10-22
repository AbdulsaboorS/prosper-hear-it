import { useRef, useState } from 'react'
import {
  AGENTS, PATIENT_VOICE, PAYER_VOICE, PRESETS, SPECIALTIES, greeting, sampleCall,
  type Agent, type AgentId, type Specialty,
} from './data'
import { Speaker } from './voice'

const speaker = new Speaker()
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Playing = { id: AgentId; index: number } | { id: 'greeting' }

export default function App() {
  const [draft, setDraft] = useState('')
  const [practice, setPractice] = useState('')
  const [specialtyId, setSpecialtyId] = useState(SPECIALTIES[0].id)
  const [playing, setPlaying] = useState<Playing | null>(null)
  const [heard, setHeard] = useState<AgentId[]>([])
  const [warm, setWarm] = useState(true)
  const [briefOpen, setBriefOpen] = useState(false)
  const runRef = useRef(0)

  const specialty = SPECIALTIES.find((s) => s.id === specialtyId)!

  function personalize(name: string, specId: string) {
    stop()
    const spec = SPECIALTIES.find((s) => s.id === specId)!
    setDraft(name)
    setPractice(name.trim())
    setSpecialtyId(specId)
    // Warm the cache with each call's opening line so the first press plays instantly.
    for (const ag of AGENTS) speaker.prefetch(sampleCall(ag.id, name.trim(), spec)[0].text, ag.voice)
    speaker.prefetch(greeting(name.trim(), spec, true), 'andromeda')
  }

  function stop() {
    runRef.current++
    speaker.stop()
    setPlaying(null)
  }

  async function playAgent(ag: Agent) {
    speaker.unlock()
    stop()
    const run = runRef.current
    const lines = sampleCall(ag.id, practice, specialty)
    const otherVoice = ag.with === 'payer' ? PAYER_VOICE : PATIENT_VOICE
    const voiceFor = (who: string) => (who === 'agent' ? ag.voice : otherVoice)
    for (const l of lines) speaker.prefetch(l.text, voiceFor(l.who))
    setHeard((h) => (h.includes(ag.id) ? h : [...h, ag.id]))

    for (let i = 0; i < lines.length; i++) {
      if (run !== runRef.current) return
      setPlaying({ id: ag.id, index: i })
      await speaker.speak(lines[i].text, voiceFor(lines[i].who))
      await wait(220)
    }
    if (run === runRef.current) setPlaying(null)
  }

  async function playGreeting() {
    speaker.unlock()
    stop()
    const run = runRef.current
    setPlaying({ id: 'greeting' })
    const text = greeting(practice, specialty, warm)
    if (warm) await speaker.speak(text, 'andromeda')
    else await speaker.speakRobot(text)
    if (run === runRef.current) setPlaying(null)
  }

  const name = practice || 'your practice'
  const greetingPlaying = playing?.id === 'greeting'

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark" aria-hidden>P</span>
          <div>
            <h1>Hear it at your practice <span className="muted">· a Prosper AI concept</span></h1>
            <p className="credit">
              Unofficial prototype by{' '}
              <a href="https://abdulsaboorshaikh.com" target="_blank" rel="noreferrer">Abdulsaboor Shaikh</a> ·{' '}
              <a href="https://linkedin.com/in/abdulsaboorshaikh" target="_blank" rel="noreferrer">LinkedIn</a>
            </p>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <h2>Hear every Prosper agent answer <em>your</em> practice's calls.</h2>
          <p className="lede">
            Enter your practice name and specialty. Every agent plays a short call with your patients and payers,
            in its own voice.
          </p>
          <form
            className="personalize"
            onSubmit={(e) => {
              e.preventDefault()
              personalize(draft, specialtyId)
            }}
          >
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Your practice name" aria-label="Practice name" />
            <select value={specialtyId} onChange={(e) => personalize(draft, e.target.value)} aria-label="Specialty">
              {SPECIALTIES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <button className="primary" type="submit" disabled={!draft.trim()}>Personalize</button>
          </form>
          <div className="presets">
            <span className="muted small">Try:</span>
            {PRESETS.map((p) => (
              <button key={p.practice} className="chip" onClick={() => personalize(p.practice, p.specialty)}>{p.practice}</button>
            ))}
          </div>
        </div>

        <div className={`greeting card ${greetingPlaying ? 'live' : ''}`}>
          <div className="greeting-head">
            <div>
              <div className="eyebrow">Anna answers {name}</div>
              <h3>{warm ? 'Warm, like your front desk' : 'Cold, like a phone tree'}</h3>
            </div>
            <div className="toggle" role="group" aria-label="Greeting style">
              <button className={!warm ? 'on cold' : ''} onClick={() => { stop(); setWarm(false) }}>Cold</button>
              <button className={warm ? 'on' : ''} onClick={() => { stop(); setWarm(true) }}>Warm</button>
            </div>
          </div>
          <blockquote className={warm ? 'warm' : 'cold'}>{greeting(practice, specialty, warm)}</blockquote>
          <div className="greeting-foot">
            <button className="primary" onClick={greetingPlaying ? stop : playGreeting}>
              {greetingPlaying ? '■ Stop' : '▶ Hear Anna'}
            </button>
            <span className="muted small">
              {warm ? "Uses the patient's name, acknowledges the worry, offers a human." : 'Menu-speak, no name, no way to a person.'}
            </span>
          </div>
        </div>
      </section>

      <section className="team">
        <div className="team-head">
          <h2>Your AI front desk{practice ? ` at ${practice}` : ''}</h2>
          <p className="muted">Press play on any agent. Each call uses your practice name and {specialty.label.toLowerCase()} details.</p>
        </div>
        {(['patient', 'payer'] as const).map((group) => (
          <AgentGroup
            key={group}
            title={group === 'patient' ? 'Patient calls' : 'Payer calls'}
            agents={AGENTS.filter((ag) => ag.with === group)}
            {...{ practice, specialty, playing, heard, playAgent, stop }}
          />
        ))}
      </section>

      {heard.length > 0 && (
        <div className="cta-bar">
          <span>
            You've heard <strong>{heard.map((id) => AGENTS.find((ag) => ag.id === id)!.name).join(', ')}</strong>.
            Ready to hear them on {practice ? `${practice}'s` : 'your'} real calls?
          </span>
          <button className="primary" onClick={() => setBriefOpen(true)}>Book a demo{practice ? ` for ${practice}` : ''} →</button>
        </div>
      )}

      {briefOpen && <Brief practice={practice} specialty={specialty.label} heard={heard} onClose={() => setBriefOpen(false)} />}

      <footer className="footer">
        Prototype with mock data only. No PHI, nothing stored. Agent names and roles are from getprosper.ai; sample calls are illustrative.
        Voices: Deepgram Aura-2 on Cloudflare Workers AI.
      </footer>
    </div>
  )
}

function AgentGroup(props: {
  title: string
  agents: Agent[]
  practice: string
  specialty: Specialty
  playing: Playing | null
  heard: AgentId[]
  playAgent: (ag: Agent) => void
  stop: () => void
}) {
  return (
    <div className="group">
      <h4 className="section-title">{props.title}</h4>
      <div className="agents">
        {props.agents.map((ag) => {
          const now = props.playing?.id === ag.id ? props.playing.index : -1
          const lines = sampleCall(ag.id, props.practice, props.specialty)
          return (
            <article key={ag.id} className={`agent ${now >= 0 ? 'playing' : ''}`}>
              <div className="agent-head">
                <div className={`avatar av-${ag.id}`}>{ag.name[0]}</div>
                <div className="agent-id">
                  <strong>{ag.name}</strong>
                  <span>{ag.role}</span>
                </div>
                <button
                  className={`play ${now >= 0 ? 'on' : ''}`}
                  onClick={() => (now >= 0 ? props.stop() : props.playAgent(ag))}
                  aria-label={now >= 0 ? `Stop ${ag.name}` : `Play ${ag.name}'s call`}
                >
                  {now >= 0 ? '■' : '▶'}
                </button>
              </div>
              {now >= 0 ? (
                <div className="lines">
                  {lines.slice(0, now + 1).map((l, i) => (
                    <p key={i} className={`line line-${l.who} ${i === now ? 'now' : ''}`}>
                      <span>{l.who === 'agent' ? ag.name : ag.with === 'payer' ? 'Payer' : 'Patient'}</span>
                      {l.text}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="blurb">{ag.blurb}{props.heard.includes(ag.id) && <span className="heard"> · Heard</span>}</p>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}

function Brief({ practice, specialty, heard, onClose }: { practice: string; specialty: string; heard: AgentId[]; onClose: () => void }) {
  const [interested, setInterested] = useState<AgentId[]>(heard)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const first = AGENTS.find((ag) => ag.id === interested[0])

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Book a demo" onClick={onClose}>
      <div className="brief card" onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <div className="sent">
            <div className="check" aria-hidden>✓</div>
            <h3>Thanks! We'll start your demo with {first?.name ?? 'your agents'}.</h3>
            <p className="muted">Someone from Prosper will reach out to {email} within a business day.</p>
            <p className="muted small">Prototype: nothing was sent.</p>
            <div className="brief-actions">
              <a className="primary" href="https://www.getprosper.ai/get-started" target="_blank" rel="noreferrer">Continue to Prosper's Get Started →</a>
              <button className="ghost" onClick={onClose}>Close</button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setSent(true)
            }}
          >
            <div className="eyebrow">Book a demo</div>
            <h3>Hear them on {practice || 'your practice'}'s real calls</h3>
            <div className="field-row">
              <label>Practice<input value={practice || ''} placeholder="Your practice" readOnly /></label>
              <label>Specialty<input value={specialty} readOnly /></label>
            </div>
            <div className="interest">
              <span>Agents you're interested in</span>
              <div>
                {AGENTS.filter((ag) => heard.includes(ag.id) || interested.includes(ag.id)).map((ag) => {
                  const on = interested.includes(ag.id)
                  return (
                    <button type="button" key={ag.id} className={`chip ${on ? 'on' : ''}`}
                      onClick={() => setInterested((xs) => (on ? xs.filter((x) => x !== ag.id) : [...xs, ag.id]))}>
                      {on ? '✓ ' : ''}{ag.name} · {ag.role}
                    </button>
                  )
                })}
              </div>
            </div>
            <label className="email">Work email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@practice.com" /></label>
            <button className="primary" type="submit">Request demo</button>
            <p className="muted small">Our team sees which agents you listened to, so your demo starts with what matters to you.</p>
          </form>
        )}
      </div>
    </div>
  )
}
