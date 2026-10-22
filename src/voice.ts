// Speaking: Deepgram Aura-2 via /api/tts (default) or Kokoro in a Web Worker (?voice=kokoro),
// with the browser's speechSynthesis as the last fallback.
// Listening: Chrome's webkitSpeechRecognition, hands-free with a silence timeout.

type WorkerOut =
  | { type: 'progress'; value: number }
  | { type: 'ready'; device: string }
  | { type: 'error'; error: string }
  | { type: 'audio'; id: number; samples: Float32Array; rate: number }

export type VoiceStatus = 'loading' | 'ready' | 'fallback'

// Voices are Aura-2 speaker names; Kokoro maps them onto its own.
const KOKORO_VOICES: Record<string, string> = {
  thalia: 'af_heart', andromeda: 'af_bella', helena: 'af_nicole', athena: 'af_sarah', hera: 'af_sky',
  luna: 'af_nova', asteria: 'af_kore', arcas: 'am_michael', apollo: 'am_adam', orion: 'am_fenrir',
  odysseus: 'am_puck', orpheus: 'am_eric', hermes: 'am_liam', aurora: 'bf_emma',
}

export class Speaker {
  readonly engine = new URLSearchParams(location.search).get('voice') === 'kokoro' ? 'kokoro' : 'aura'
  status: VoiceStatus = this.engine === 'aura' ? 'ready' : 'loading'
  progress = 0
  onStatus?: () => void

  private worker?: Worker
  private ctx = new AudioContext()
  private source?: AudioBufferSourceNode
  private pending = new Map<number, (a: { samples: Float32Array; rate: number }) => void>()
  private cache = new Map<string, Promise<AudioBuffer>>()
  private nextId = 0
  private generation = 0

  constructor() {
    if (this.engine === 'kokoro') this.loadKokoro()
  }

  private loadKokoro() {
    this.worker = new Worker(new URL('./tts.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      const m = e.data
      if (m.type === 'progress') this.progress = m.value
      else if (m.type === 'ready') this.status = 'ready'
      else if (m.type === 'error') {
        console.warn('Kokoro failed, using browser voice', m.error)
        this.status = 'fallback'
      } else if (m.type === 'audio') {
        this.pending.get(m.id)?.(m)
        this.pending.delete(m.id)
      }
      this.onStatus?.()
    }
    const device = new URLSearchParams(location.search).get('voice-device') ?? undefined
    this.worker.postMessage({ type: 'load', device })
  }

  useFallback() {
    this.status = 'fallback'
    this.onStatus?.()
  }

  // Must be called from a user gesture so audio can play.
  unlock() {
    void this.ctx.resume()
  }

  stop() {
    this.generation++
    this.source?.stop()
    this.source = undefined
    speechSynthesis.cancel()
  }

  // Resolves when the line finishes or is stopped. `onSentence` fires as each sentence starts.
  // Pass an array to control sentence boundaries exactly (e.g. to sync highlights).
  async speak(text: string | string[], voice = 'thalia', onSentence?: (i: number) => void) {
    const gen = ++this.generation
    const sentences = typeof text === 'string' ? splitSentences(text) : text
    if (!sentences.length) return
    if (this.status !== 'ready') return this.speakBrowser(sentences.join(' '), gen)

    const audios = sentences.map((s) => this.generate(s, voice))
    for (let i = 0; i < sentences.length; i++) {
      const audio = await audios[i].catch(() => null)
      if (!audio) {
        // Voice service unavailable: say the rest with the browser voice.
        return this.speakBrowser(sentences.slice(i).join(' '), gen)
      }
      if (gen !== this.generation) return
      onSentence?.(i)
      await this.play(audio, gen)
      if (gen !== this.generation) return
    }
  }

  // The deliberately flat "cold" voice for the comparison.
  speakRobot(text: string) {
    const gen = ++this.generation
    return this.speakBrowser(text, gen, true)
  }

  // Generate scripted lines ahead of time (while the user is talking) so they play instantly.
  prefetch(text: string | string[], voice = 'thalia') {
    if (this.status !== 'ready') return
    for (const s of typeof text === 'string' ? splitSentences(text) : text) this.generate(s, voice).catch(() => {})
  }

  // Cached per sentence, so prefetched lines play instantly and replays cost nothing.
  private generate(text: string, voice: string) {
    const key = `${voice}|${text}`
    let audio = this.cache.get(key)
    if (!audio) {
      audio = this.engine === 'aura' ? this.fetchAura(text, voice) : this.runKokoro(text, voice)
      audio.catch(() => this.cache.delete(key))
      this.cache.set(key, audio)
    }
    return audio
  }

  private async fetchAura(text: string, voice: string) {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, speaker: voice }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`tts ${res.status}`)
    return this.ctx.decodeAudioData(await res.arrayBuffer())
  }

  private runKokoro(text: string, voice: string) {
    const id = this.nextId++
    return new Promise<AudioBuffer>((resolve) => {
      this.pending.set(id, ({ samples, rate }) => {
        const buffer = this.ctx.createBuffer(1, samples.length, rate)
        buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0)
        resolve(buffer)
      })
      this.worker!.postMessage({ type: 'generate', id, text, voice: KOKORO_VOICES[voice] ?? 'af_heart', speed: 1 })
    })
  }

  private play(buffer: AudioBuffer, gen: number) {
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.ctx.destination)
    this.source = source
    return new Promise<void>((resolve) => {
      source.onended = () => resolve()
      if (gen !== this.generation) return resolve()
      source.start()
    })
  }

  private speakBrowser(text: string, gen: number, robot = false) {
    return new Promise<void>((resolve) => {
      if (gen !== this.generation) return resolve()
      const u = new SpeechSynthesisUtterance(text)
      const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'))
      u.voice = robot
        ? voices.find((v) => /Fred|Ralph|Albert/.test(v.name)) ?? voices[0] ?? null
        : voices.find((v) => /Samantha|Google US English|Ava|Allison/.test(v.name)) ?? voices[0] ?? null
      u.rate = robot ? 1.05 : 1
      u.pitch = robot ? 0.7 : 1
      u.onend = () => resolve()
      u.onerror = () => resolve()
      speechSynthesis.speak(u)
    })
  }
}

export function splitSentences(text: string) {
  if (!text.trim()) return []
  const parts = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [text]
  // Merge very short fragments so the voice doesn't stutter between tiny chunks.
  const out: string[] = []
  for (const p of parts.map((s) => s.trim()).filter(Boolean)) {
    if (out.length && out[out.length - 1].length < 25) out[out.length - 1] += ' ' + p
    else out.push(p)
  }
  return out
}

interface Recognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}

const RecognitionCtor = (window as unknown as { webkitSpeechRecognition?: new () => Recognition; SpeechRecognition?: new () => Recognition })
const Ctor = RecognitionCtor.SpeechRecognition ?? RecognitionCtor.webkitSpeechRecognition

export const canListen = !!Ctor

const SILENCE_MS = 1600

export class Listener {
  onInterim?: (text: string) => void
  onError?: (error: string) => void

  private rec?: Recognition
  private active = false
  private finalText = ''
  private interimText = ''
  private timer?: number
  private resolve?: (text: string) => void

  // Resolves with what the user said once they pause, or '' if cancelled.
  listen(): Promise<string> {
    this.cancel()
    if (!Ctor) return Promise.resolve('')
    this.active = true
    this.finalText = ''
    this.interimText = ''
    return new Promise((resolve) => {
      this.resolve = resolve
      this.startRec()
    })
  }

  // Ends the turn now with whatever was heard so far.
  finish() {
    if (!this.active) return
    this.done((this.finalText + ' ' + this.interimText).trim())
  }

  cancel() {
    if (this.active) this.done('')
  }

  get listening() {
    return this.active
  }

  private startRec() {
    const rec = new Ctor!()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) this.finalText += ' ' + r[0].transcript
        else interim += r[0].transcript
      }
      this.interimText = interim
      this.onInterim?.((this.finalText + ' ' + interim).trim())
      window.clearTimeout(this.timer)
      this.timer = window.setTimeout(() => this.finish(), SILENCE_MS)
    }
    rec.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') this.onError?.(e.error)
    }
    // Chrome ends recognition on its own after a while; keep going until the turn is done.
    rec.onend = () => {
      if (this.active && this.rec === rec) this.startRec()
    }
    this.rec = rec
    rec.start()
  }

  private done(text: string) {
    this.active = false
    window.clearTimeout(this.timer)
    const rec = this.rec
    this.rec = undefined
    rec?.abort()
    this.onInterim?.('')
    const resolve = this.resolve
    this.resolve = undefined
    resolve?.(text)
  }
}
