# Prosper Voice Onboarder

An unofficial prototype for [Prosper AI](https://www.getprosper.ai). A healthcare practice leader talks to a warm voice agent, **Prosper Guide**, for about three minutes. They leave with their AI voice agent team configured, their own agent greeting a patient by name, and a filled-in kickoff request for Prosper's team.

Built by [Abdul Saboor Shaikh](https://abdulsaboorshaikh.com) ([LinkedIn](https://linkedin.com/in/abdulsaboorshaikh)). This is a concept from someone who wants to work at Prosper; it is not affiliated with Prosper. All data is mock data: no PHI, no real EHR integration, nothing is stored or sent.

## Why

On getprosper.ai today, the only way to experience the product is a "Get Started" form, a sales call, or dialing a number. Under *Use Cases → Meet Your AI Voice Agent Team*, only Anna (Appointment Scheduling) has a recording, and you have to expand her card to find it. The first touch is a form, which is the coldness Prosper is trying to remove from healthcare.

This prototype makes the first touch the product itself: a warm voice agent that listens, sets up your team while you talk, plays your own agent, and books the kickoff.

**For Prosper:** practices hear their own agent before they talk to sales, and Agent Managers start Week 1 already knowing the practice's EHR, call volume, problem hours, team, and warmth rules.

## Run it

```bash
npm install
npm run dev        # builds, then serves the app + AI endpoint at http://localhost:8788
```

Use Chrome for voice input. `npm run dev` needs `wrangler` logged in to a Cloudflare account, because the AI endpoint calls Workers AI. Without that, run `npm run dev:ui` (Vite only): the app falls back to its built-in keyword understanding and everything still works.

Deploy: `npm run deploy` (Cloudflare Pages).

## How it works

| Piece | What it does |
|---|---|
| **Voice out** | Deepgram **Aura-2** on Workers AI (`functions/api/tts.ts`), about 0.3s to first byte. Each agent has its own voice. Scripted lines are pre-generated while you talk and cached at the edge, so replays don't use Workers AI quota. Falls back to the browser's `speechSynthesis`. Add `?voice=kokoro` to run [Kokoro](https://github.com/hexgrad/kokoro) fully in the browser instead (free, no server, but only about real-time on WASM, so replies lag). |
| **Voice in** | Chrome's built-in `webkitSpeechRecognition`, hands-free. It listens after the guide finishes and ends your turn after a short pause. The mic button interrupts the guide or ends your turn early. |
| **Understanding** | `functions/api/turn.ts`, a Cloudflare Pages Function, calls Workers AI (`llama-3.3-70b-instruct-fp8-fast`) in JSON mode. Each turn it pulls the answers out of what you said and writes a short, specific acknowledgement. |
| **Fallback** | `src/flow.ts` has keyword slot-filling and scripted acknowledgements with the same output shape. Used when the API is slow (over 6s) or down, so the demo never stalls. |
| **Agent actions** | The guide drives the right pane: it switches views, highlights each agent as it introduces them, plays a sample call, plays your greeting, and fills in the kickoff form field by field. |
| **Typed fallback** | Every question has typed input and quick-reply chips. |

### The flow

The left pane is a call, not a chat: a voice orb, a call timer, and live captions. The full transcript and typed input are one click away. The right pane is read-only and labeled *Built live by Prosper Guide*, so it reads as the agent's output, not a form to fill in.

Four questions, each answered in one natural sentence. The model pulls several facts out of each answer:

1. Name, practice, specialty, size, EHR
2. Which calls eat the front desk's day, when it hurts most, and call volume
3. **Warmth:** how the front desk welcomes patients, when a patient must always be offered a human, and languages
4. Email and role (asked at the kickoff step)

In between, the guide drives the right pane:

- **Your AI team:** introduces each agent while highlighting it, and offers a sample call.
- **Your agent:** Anna greets a patient using the practice name and warmth rules. A **Cold / Warm** toggle and **Hear your agent** sit next to the greeting, with the 3-week path to live below.
- **Kickoff:** fills in the "talk to our team" request field by field, then sends it (mock) once you confirm.
- **Done screen:** the **lead brief Prosper's sales team receives** (fit signals, contact, agents to deploy, warmth rules, a suggested demo opener, and how long it took to capture by voice), plus a link to Prosper's real Get Started page.

Three presets (Dermatology, OBGYN, GI) run the same call automatically. **Skip ahead** cuts the current line.

## Agent mapping

| Call type | Agent | Role |
|---|---|---|
| Scheduling | Anna | Appointment Scheduling |
| Billing questions | Emma | Inbound Billing Questions |
| Billing questions | Ben | Patient Balance Reminders |
| Reminders | Tom | Appointment Reminders |
| Switchboard | Jack | Switchboard |
| Benefits verification | Alex | Benefits Verification |
| Prior auth | Kate | Prior Authorization |
| Claims & denials | Lucy | Claim Follow-up |
| Claims & denials | Mary | Denial Follow-up |
| Refills | James | Prescription Refills |
| Recalls | Sara | Re-Engagement Campaigns |

Agent names and roles are taken from getprosper.ai/use-cases. Payer-side agents are left out because this onboards a provider practice. Sample call scripts are illustrative.

## Loom script (about 90 seconds)

**0:00–0:15 · Today's first touch.** On getprosper.ai, go to Use Cases → Meet Your AI Voice Agent Team. Point at Anna's Recording link at the bottom of her expanded card; she's the only one with a recording. Everything else is Get Started or a phone number.
> "Prosper sells voice agents, but a practice's first touch is a form."

**0:15–1:05 · What I'd build if I worked at Prosper.** Open the onboarder and click **Start a call**. Answer the four questions out loud in one breath each, and cut the pauses in editing:
- "I'm Abdul, I run ops at Bayview Dermatology. Twelve providers, on ModMed."
- "Prior auths and scheduling are killing us, plus benefits checks. After hours is worst, maybe 600 calls a day."
- "We greet everyone by name. Anyone anxious about a biopsy result always gets a person. English and Spanish."
- At the team step: "No thanks." Or "play Kate" if you have time for the sample call.

Point at the right pane building itself as you talk.

**1:05–1:20 · The punchline.** Anna greets your patient. Flip to **Cold**, press **Hear your agent**, then flip back to **Warm**.
> "Same agent. One sounds like a phone tree, one sounds like your front desk."

**1:20–1:30 · Booked.** Give your email and role, then say "yes, send it." The lead brief appears.
> "The prospect has felt the product, and sales gets the EHR, call volume, warmth rules and a demo opener before the first call. That's what I'd ship."

*If the mic acts up during recording, click a preset (Dermatology is the best one). It runs the same call on its own.*

## Project layout

```
src/
  App.tsx         conversation runner + guide pane
  RightPane.tsx   live setup, team, agent greeting, kickoff views
  flow.ts         steps, questions, keyword fallback understanding
  brain.ts        calls /api/turn, merges with the fallback
  voice.ts        Kokoro speaker + hands-free speech recognition
  tts.worker.ts   Kokoro in a Web Worker
  data.ts         agents, call types, presets, scripts
functions/api/turn.ts   Workers AI slot extraction + acknowledgements
functions/api/tts.ts    Aura-2 text-to-speech with edge caching
public/_headers         cross-origin isolation, so Kokoro's WASM can use threads
```
