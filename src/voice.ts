// Deepgram Aura-2 via /api/tts, falling back to the browser's speechSynthesis.

export class Speaker {
  private ctx = new AudioContext()
  private source?: AudioBufferSourceNode
  private cache = new Map<string, Promise<AudioBuffer>>()
  private generation = 0

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
    const audios = sentences.map((s) => this.generate(s, voice))
    for (let i = 0; i < sentences.length; i++) {
      const audio = await audios[i].catch(() => null)
      if (gen !== this.generation) return
      if (!audio) {
        // Voice service unavailable: say the rest with the browser voice.
        onSentence?.(i)
        return this.speakBrowser(sentences.slice(i).join(' '), gen)
      }
      onSentence?.(i)
      await this.play(audio, gen)
      if (gen !== this.generation) return
    }
  }

  // Fetch lines ahead of time (while the user is talking) so they play instantly.
  prefetch(text: string | string[], voice = 'thalia') {
    for (const s of typeof text === 'string' ? splitSentences(text) : text) this.generate(s, voice).catch(() => {})
  }

  // Cached per sentence, so prefetched lines play instantly and replays cost nothing.
  private generate(text: string, voice: string) {
    const key = `${voice}|${text}`
    let audio = this.cache.get(key)
    if (!audio) {
      audio = this.fetchAudio(text, voice)
      audio.catch(() => this.cache.delete(key))
      this.cache.set(key, audio)
    }
    return audio
  }

  private async fetchAudio(text: string, voice: string) {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, speaker: voice }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`tts ${res.status}`)
    return this.ctx.decodeAudioData(await res.arrayBuffer())
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

  private speakBrowser(text: string, gen: number) {
    return new Promise<void>((resolve) => {
      if (gen !== this.generation) return resolve()
      const u = new SpeechSynthesisUtterance(text)
      const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'))
      u.voice = voices.find((v) => /Ava|Allison|Samantha|Google US English/.test(v.name)) ?? voices[0] ?? null
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
