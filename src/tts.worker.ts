import { KokoroTTS } from 'kokoro-js'

type In =
  | { type: 'load'; device?: 'wasm' | 'webgpu' }
  | { type: 'generate'; id: number; text: string; voice: string; speed: number }

let tts: KokoroTTS | undefined

self.onmessage = async (e: MessageEvent<In>) => {
  const msg = e.data
  if (msg.type === 'load') {
    try {
      const files: Record<string, number> = {}
      // Threaded WASM measured at about real time on Apple Silicon; WebGPU is opt-in (?voice-device=webgpu).
      const device = msg.device ?? 'wasm'
      tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        // Kokoro's docs recommend fp32 on WebGPU; q8 keeps the WASM download small.
        dtype: device === 'webgpu' ? 'fp32' : 'q8',
        device,
        progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
          if (p.status !== 'progress' || !p.file || !p.total) return
          files[p.file] = p.loaded! / p.total
          const values = Object.values(files)
          self.postMessage({ type: 'progress', value: values.reduce((a, b) => a + b, 0) / values.length })
        },
      })
      // Warm the graph so the first real line isn't slow.
      await tts.generate('Hi.', { voice: 'af_heart' })
      self.postMessage({ type: 'ready', device })
    } catch (err) {
      self.postMessage({ type: 'error', error: String(err) })
    }
    return
  }
  if (!tts) return
  const audio = await tts.generate(msg.text, { voice: msg.voice as never, speed: msg.speed })
  const samples = audio.audio as Float32Array
  self.postMessage({ type: 'audio', id: msg.id, samples, rate: audio.sampling_rate }, { transfer: [samples.buffer] })
}

