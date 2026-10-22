import { useEffect, useRef, useState } from 'react'
import { understand } from './brain'
import {
  AGENTS, PRESETS, emptyProfile, greetingScript, sampleCall, teamFor,
  type AgentId, type Preset, type Profile, type SampleLine,
} from './data'
import { STEPS, nextStep, type StepId, type View } from './flow'
import { RightPane, type BookField } from './RightPane'
import { Listener, Speaker, canListen, splitSentences } from './voice'

const speaker = new Speaker()
const listener = new Listener()

const GUIDE_VOICE = 'thalia'
const PATIENT_VOICE = 'aurora'
const FEATURED: AgentId[] = ['kate', 'anna', 'alex', 'emma']
const BOOK_FIELDS: BookField[] = ['name', 'practice', 'specialty', 'providers', 'ehr', 'volume', 'team', 'warmth']

interface Message {
  id: number
  who: 'guide' | 'user'
  text: string
}

type Mode = 'voice' | 'text' | 'preset'

class Cancelled extends Error {}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function App() {
  const [started, setStarted] = useState(false)
  const [mode, setMode] = useState<Mode>('voice')
  const [step, setStep] = useState<StepId>('intro')
  const [profile, setProfile] = useState<Profile>(emptyProfile)
  const [messages, setMessages] = useState<Message[]>([])
  const [view, setView] = useState<View>('setup')
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [interim, setInterim] = useState('')
  const [draft, setDraft] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [highlight, setHighlight] = useState<AgentId | null>(null)
  const [sample, setSample] = useState<{ agent: AgentId; lines: SampleLine[]; index: number } | null>(null)
  const [warm, setWarm] = useState(true)
  const [filled, setFilled] = useState<BookField[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [, setVoiceTick] = useState(0)
  const [micError, setMicError] = useState('')
  const [showTranscript, setShowTranscript] = useState(false)
  const [callStart, setCallStart] = useState(0)
  const [callSeconds, setCallSeconds] = useState(0)

  const runRef = useRef(0)
  const profileRef = useRef(profile)
  const modeRef = useRef<Mode>(mode)
  const presetRef = useRef<{ preset: Preset; index: number } | null>(null)
  const replyRef = useRef<((text: string) => void) | null>(null)
  const skipRef = useRef(0)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const msgId = useRef(0)

  useEffect(() => {
    const prefetchIntro = () => speaker.prefetch(STEPS[0].ask(emptyProfile()))
    speaker.onStatus = () => {
      setVoiceTick((n) => n + 1)
      prefetchIntro()
    }
    prefetchIntro()
    listener.onInterim = setInterim
    listener.onError = (e) => setMicError(e === 'not-allowed' ? 'Microphone blocked. You can type instead.' : `Mic error: ${e}`)
  }, [])

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, interim, showTranscript])

  // Call timer; freezes once the kickoff is sent.
  useEffect(() => {
    if (!started || submitted) return
    const id = window.setInterval(() => setCallSeconds(Math.floor((Date.now() - callStart) / 1000)), 500)
    return () => window.clearInterval(id)
  }, [started, submitted, callStart])

  const setModeBoth = (m: Mode) => {
    modeRef.current = m
    setMode(m)
  }

  const updateProfile = (patch: Partial<Profile>) => {
    profileRef.current = { ...profileRef.current, ...patch }
    setProfile(profileRef.current)
  }

  const addMessage = (who: Message['who'], text: string) =>
    setMessages((m) => [...m, { id: msgId.current++, who, text }])

  // ---- conversation runner -------------------------------------------------

  function guard(run: number) {
    if (run !== runRef.current) throw new Cancelled()
  }

  // Pieces are split into sentences separately so prefetched lines hit the audio cache.
  async function say(run: number, ...pieces: string[]) {
    guard(run)
    const text = pieces.filter((p) => p.trim()).join(' ')
    if (!text) return
    addMessage('guide', text)
    setSpeaking(true)
    await speaker.speak(pieces.flatMap(splitSentences), GUIDE_VOICE)
    setSpeaking(false)
    guard(run)
  }

  async function getReply(run: number): Promise<string> {
    guard(run)
    const preset = presetRef.current
    if (modeRef.current === 'preset' && preset) {
      const line = preset.preset.lines[preset.index++] ?? 'Yes.'
      await wait(500)
      const skip = skipRef.current
      for (let i = 1; i <= line.length; i += 2) {
        guard(run)
        if (skipRef.current !== skip) break
        setDraft(line.slice(0, i))
        await wait(22)
      }
      setDraft('')
      return line
    }

    const reply = new Promise<string>((resolve) => {
      replyRef.current = resolve
    })
    if (modeRef.current === 'voice' && canListen) void listenInto(run)
    const text = await reply
    replyRef.current = null
    listener.cancel()
    setListening(false)
    guard(run)
    return text
  }

  async function listenInto(run: number) {
    setMicError('')
    setListening(true)
    const heard = await listener.listen()
    setListening(false)
    if (run !== runRef.current || !replyRef.current) return
    if (heard) replyRef.current(heard)
  }

  function submitReply(text: string) {
    const t = text.trim()
    if (!t || !replyRef.current) return
    setDraft('')
    setPicked([])
    replyRef.current(t)
  }

  async function playSample(run: number, agent: AgentId) {
    const lines = sampleCall(agent, profileRef.current.practice ?? '')
    const skip = skipRef.current
    setHighlight(agent)
    for (let i = 0; i < lines.length; i++) {
      guard(run)
      if (skipRef.current !== skip) break
      setSample({ agent, lines, index: i })
      await speaker.speak(lines[i].text, lines[i].who === 'agent' ? AGENTS[agent].voice : PATIENT_VOICE)
      await wait(250)
    }
    guard(run)
    setSample((s) => (s ? { ...s, index: s.lines.length } : s))
  }

  function teamIntro() {
    const p = profileRef.current
    const team = teamFor(p.callTypes.length ? p.callTypes : ['scheduling'])
    const featured = FEATURED.find((a) => team.includes(a)) ?? team[0]
    const lines = [
      `Here's your team${p.name ? `, ${p.name}` : ''}.`,
      ...team.map((id) => `${AGENTS[id].name} handles ${AGENTS[id].role.toLowerCase()}.`),
      `Want to hear one of them on a real call? ${AGENTS[featured].name} is a good place to start.`,
    ]
    return { team, featured, lines }
  }

  async function introduceTeam(run: number): Promise<AgentId> {
    const { team, featured, lines } = teamIntro()
    addMessage('guide', lines.join(' '))
    setSpeaking(true)
    // First line is the intro, so agent i lines up with line i + 1.
    await speaker.speak(lines, GUIDE_VOICE, (i) => setHighlight(team[i - 1] ?? null))
    setSpeaking(false)
    guard(run)
    setHighlight(null)
    return featured
  }

  const greetingIntro = () =>
    `Now my favorite part. Here's how Anna would greet a patient calling ${profileRef.current.practice ?? 'your practice'}.`
  const BOOK_PROMPT = "That's your agent, in your voice. Want to get it live? I've already filled in a kickoff request for our team from everything you told me. I just need your email and your role."

  // Queue audio for whatever the guide will say after this reply, while the user is still talking.
  function prefetchAfter(step: StepId) {
    const p = profileRef.current
    const next = nextStep(step)
    if (step === 'warmth') {
      speaker.prefetch(teamIntro().lines)
    } else if (step === 'tour') {
      const { featured } = teamIntro()
      for (const l of sampleCall(featured, p.practice ?? '')) speaker.prefetch(l.text, l.who === 'agent' ? AGENTS[featured].voice : PATIENT_VOICE)
      speaker.prefetch(greetingIntro())
      speaker.prefetch(greetingScript(p, true), AGENTS.anna.voice)
      speaker.prefetch(BOOK_PROMPT)
    } else if (next !== 'tour' && next !== 'book' && next !== 'done') {
      speaker.prefetch(STEPS.find((s) => s.id === next)!.ask(p))
    }
  }

  async function showGreetingAndBook(run: number, prefix: string) {
    setView('greeting')
    setWarm(true)
    const p = profileRef.current
    await say(run, prefix, greetingIntro())
    await wait(300)
    setSpeaking(true)
    await speaker.speak(greetingScript(p, true), AGENTS.anna.voice)
    setSpeaking(false)
    guard(run)
    await wait(400)
    setView('book')
    setFilled([])
    const fill = (async () => {
      for (const f of BOOK_FIELDS) {
        await wait(260)
        guard(run)
        setFilled((x) => [...x, f])
      }
    })()
    await say(run, BOOK_PROMPT)
    await fill
  }

  async function runConversation(run: number) {
    let step: StepId = 'intro'
    let prefix = ''
    let reask = true
    let featured: AgentId = 'anna'

    while (step !== 'done') {
      const def = STEPS.find((s) => s.id === step)!
      setStep(step)
      let question = def.ask(profileRef.current)

      if (reask) {
        if (step === 'tour') {
          setView('team')
          if (prefix) await say(run, prefix)
          featured = await introduceTeam(run)
          question = 'Want to hear one of them on a real call?'
        } else if (step === 'book') {
          await showGreetingAndBook(run, prefix)
          question = 'What is your email and your role?'
        } else {
          if (step !== 'confirm') setView(def.view)
          await say(run, prefix, question)
        }
      }
      prefix = ''

      prefetchAfter(step)
      const reply = await getReply(run)
      addMessage('user', reply)
      setThinking(true)
      const result = await understand(step, question, reply, profileRef.current)
      setThinking(false)
      guard(run)
      updateProfile(result.slots)

      if (!result.advance) {
        await say(run, result.ack)
        reask = false
        continue
      }
      reask = true

      if (step === 'tour' && result.playSample) {
        const id = (result.playSample in AGENTS ? result.playSample : featured) as AgentId
        await playSample(run, id)
        prefix = `That was ${AGENTS[id].name}.`
      } else if (step === 'tour') {
        prefix = 'No problem.'
      } else {
        prefix = result.ack
      }
      step = nextStep(step)
    }

    setStep('done')
    setSubmitted(true)
    const p = profileRef.current
    await say(run, `Sent. Someone from Prosper will reach out within a business day to book your week one kickoff with an Agent Manager. Thank you${p.name ? `, ${p.name}` : ''}, it was lovely meeting you.`)
  }

  function start(m: Mode, preset?: Preset) {
    speaker.unlock()
    speaker.stop()
    listener.cancel()
    const run = ++runRef.current
    profileRef.current = emptyProfile()
    setProfile(profileRef.current)
    setMessages([])
    setView('setup')
    setStep('intro')
    setHighlight(null)
    setSample(null)
    setFilled([])
    setSubmitted(false)
    setWarm(true)
    setDraft('')
    setPicked([])
    presetRef.current = preset ? { preset, index: 0 } : null
    setModeBoth(m)
    setShowTranscript(false)
    setCallStart(Date.now())
    setCallSeconds(0)
    setStarted(true)
    runConversation(run).catch((err) => {
      if (!(err instanceof Cancelled)) console.error(err)
    })
  }

  function restart() {
    runRef.current++
    speaker.stop()
    listener.cancel()
    replyRef.current = null
    setSpeaking(false)
    setListening(false)
    setThinking(false)
    setStarted(false)
    setMessages([])
    profileRef.current = emptyProfile()
    setProfile(profileRef.current)
    setView('setup')
    setStep('intro')
    setSubmitted(false)
    setFilled([])
    setSample(null)
    setHighlight(null)
    setDraft('')
  }

  function skipAhead() {
    skipRef.current++
    speaker.stop()
  }

  function onMic() {
    speaker.unlock()
    if (speaking) {
      // Interrupt: stop talking; the runner moves on to listening.
      skipRef.current++
      speaker.stop()
      if (modeRef.current !== 'voice') setModeBoth('voice')
      return
    }
    if (listening) {
      listener.finish()
      return
    }
    setModeBoth('voice')
    if (replyRef.current) void listenInto(runRef.current)
  }

  async function hearAgent() {
    speaker.unlock()
    speaker.stop()
    setSpeaking(true)
    const text = greetingScript(profileRef.current, warm)
    if (warm) await speaker.speak(text, AGENTS.anna.voice)
    else await speaker.speakRobot(text)
    setSpeaking(false)
  }

  // ---- render ----------------------------------------------------------------

  const def = STEPS.find((s) => s.id === step)!
  const waiting = started && !speaking && !thinking && step !== 'done' && mode !== 'preset'
  const orbState = listening ? 'listening' : speaking ? 'speaking' : thinking ? 'thinking' : 'idle'
  const statusText = listening ? 'Listening…' : speaking ? 'Speaking…' : thinking ? 'Thinking…'
    : step === 'done' ? 'Kickoff sent' : mode === 'text' ? 'Your turn, type below' : mode === 'preset' ? '' : 'Your turn, just talk'
  const lastGuide = [...messages].reverse().find((m) => m.who === 'guide')
  const lastUser = messages.length && messages[messages.length - 1].who === 'user' ? messages[messages.length - 1].text : ''
  const userCaption = interim || draft || lastUser

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark" aria-hidden>P</span>
          <div>
            <h1>Prosper Voice Onboarder <span className="muted">— a prototype</span></h1>
            <p className="credit">
              Unofficial concept built by a PM who wants to work at Prosper ·{' '}
              <a href="https://abdulsaboorshaikh.com" target="_blank" rel="noreferrer">Abdul Saboor Shaikh</a> ·{' '}
              <a href="https://linkedin.com/in/abdulsaboorshaikh" target="_blank" rel="noreferrer">LinkedIn</a>
            </p>
          </div>
        </div>
      </header>

      <main className="main">
        <section className="guide card">
          {!started ? (
            <Welcome onStart={start} />
          ) : (
            <>
              <div className="call-top">
                <span className="eyebrow">{step === 'done' ? 'Call ended' : mode === 'preset' ? 'Sample call' : 'On a call'}</span>
                <span className="timer">{formatTime(callSeconds)}</span>
                <button className="link small" onClick={() => setShowTranscript((v) => !v)}>
                  {showTranscript ? 'Hide transcript' : 'Show transcript'}
                </button>
              </div>

              {showTranscript ? (
                <div className="transcript" ref={transcriptRef}>
                  {messages.map((m) => (
                    <div key={m.id} className={`bubble from-${m.who}`}>{m.text}</div>
                  ))}
                  {interim && <div className="bubble from-user interim">{interim}</div>}
                </div>
              ) : (
                <div className="stage">
                  <div className={`orb big-orb orb-${orbState}`} aria-hidden>
                    <span /><span /><span />
                  </div>
                  <div className="who">Prosper Guide</div>
                  <div className="status">{statusText}</div>
                  <p className="caption" key={lastGuide?.id}>{lastGuide?.text}</p>
                  {userCaption && <p className={`caption-user ${interim || draft ? 'live' : ''}`}>{userCaption}</p>}
                  {thinking && <div className="typing"><i /><i /><i /></div>}
                </div>
              )}

              {micError && <div className="mic-error">{micError}</div>}

              {mode === 'text' && waiting && def.quickReplies && (
                <div className="chips">
                  {def.quickReplies.map((q) => {
                    const on = picked.includes(q)
                    return (
                      <button
                        key={q}
                        className={`chip ${on ? 'on' : ''}`}
                        onClick={() => (def.multi ? setPicked((xs) => (on ? xs.filter((x) => x !== q) : [...xs, q])) : submitReply(q))}
                      >
                        {q}
                      </button>
                    )
                  })}
                  {def.multi && picked.length > 0 && (
                    <button className="chip go" onClick={() => submitReply(picked.join(', '))}>Continue →</button>
                  )}
                </div>
              )}

              {mode === 'text' && step !== 'done' && (
                <form
                  className="composer"
                  onSubmit={(e) => {
                    e.preventDefault()
                    submitReply(draft)
                  }}
                >
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type your answer" autoFocus />
                  <button type="submit" className="send" disabled={!draft.trim()}>Send</button>
                </form>
              )}

              <div className="controls">
                {mode === 'preset' ? (
                  <span className="muted small">Sample practice, answering automatically</span>
                ) : (
                  <button className="link small" onClick={() => setModeBoth(mode === 'text' ? 'voice' : 'text')} disabled={step === 'done'}>
                    {mode === 'text' ? 'Use voice' : 'Type instead'}
                  </button>
                )}
                <button
                  className={`mic ${listening ? 'live' : ''}`}
                  onClick={onMic}
                  disabled={!canListen || step === 'done' || mode === 'preset'}
                  title={speaking ? 'Interrupt' : listening ? 'Done talking' : 'Talk'}
                  aria-label={speaking ? 'Interrupt' : listening ? 'Done talking' : 'Talk'}
                >
                  <MicIcon size={24} />
                </button>
                {step !== 'done' && (speaking || mode === 'preset') ? (
                  <button className="ghost small" onClick={skipAhead}>Skip ahead ›</button>
                ) : (
                  <button className="ghost small end" onClick={restart}>{step === 'done' ? 'Start over' : 'End call'}</button>
                )}
              </div>
            </>
          )}
        </section>

        <RightPane
          profile={profile}
          step={step}
          view={view}
          onView={setView}
          highlight={highlight}
          sample={sample}
          warm={warm}
          onWarm={setWarm}
          onHear={hearAgent}
          filled={filled}
          submitted={submitted}
          onRestart={restart}
          onEditField={(patch) => updateProfile(patch)}
          callSeconds={callSeconds}
        />
      </main>

      <footer className="footer">
        Prototype with mock data only. No PHI, no real EHR integration, no data is stored. Agent names and roles are from getprosper.ai; sample calls are illustrative.
      </footer>
    </div>
  )
}

function Welcome({ onStart }: { onStart: (m: Mode, preset?: Preset) => void }) {
  return (
    <div className="welcome">
      <div className="orb big-orb orb-idle" aria-hidden><span /><span /><span /></div>
      <h2>Skip the demo form. Talk to a Prosper agent for two minutes.</h2>
      <p className="lede">
        It's the same technology that will answer your patients' calls. Tell it about your practice and it
        builds your AI front desk while you talk: your agents, your warmth rules, your kickoff with our team.
      </p>
      <button className="primary big" onClick={() => onStart(canListen ? 'voice' : 'text')}>
        <PhoneIcon /> Start a call
      </button>
      <button className="link small" onClick={() => onStart('text')}>or type instead</button>
      {!canListen && <p className="muted small">Voice input needs Chrome. Typing works everywhere.</p>}

      <div className="presets">
        <div className="eyebrow">Or listen to a sample call</div>
        {PRESETS.map((p) => (
          <button key={p.id} className="preset" onClick={() => onStart('preset', p)}>
            <strong>{p.label}</strong>
            <span>{p.detail}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </svg>
  )
}

function MicIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}

