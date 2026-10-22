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

1. Name, practice, specialty
2. Which calls eat the front desk's day (multi-select)
3. EHR
4. When calls hurt most, and calls per day
5. **Warmth:** how the front desk welcomes patients, and when a patient must always be offered a human
6. Languages

Then the guide:

- switches to **Your AI team**, introduces each agent, and offers a sample call;
- switches to **Your agent**, which shows the configured team, the 3-week path to live, and Anna's greeting using the practice name and warmth rules (with a **Cold / Warm** toggle and **Hear your agent**);
- switches to **Kickoff**, fills in the "talk to our team" form from the conversation, asks for email and role, and sends it (mock) after you confirm. Finally, it links to Prosper's real Get Started page and offers the setup brief to copy.

Three presets (Dermatology, OBGYN, GI) run the same flow automatically at natural pace. **Skip ahead** cuts the current line.

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

## Loom script (about 2 minutes)

**0:00–0:20 · Cold open.** Show Xavier's Oct 21 post about people fearing AI brings distance and coldness, and about customers still coming to the ModMed booth for human connection.
> "Xavier's right. So I looked at how a practice first meets Prosper today."

**0:20–0:40 · The buried demo.** Open getprosper.ai → Use Cases → Meet Your AI Voice Agent Team. Scroll the agents. Expand Anna and point at the Recording link at the bottom. Then show that everything else is Get Started or a phone number.
> "The product is a voice agent, but the first touch is a form."

**0:40–1:35 · Talk to it.** Open the onboarder and click **Talk to Prosper Guide**. Answer out loud, naturally:
- "I'm Abdul, I run ops at Bayview Dermatology, twelve providers."
- "Prior auths and scheduling are killing us, and benefits checks."
- "ModMed." · "After hours, maybe 600 calls a day."
- Warmth: "We greet people by name, and anyone anxious about a biopsy result always gets a human."
- "English and Spanish." · "Sure, play Kate."

Point at the right pane as it fills in, as agents join the team, and as Kate takes a call. (Use **Skip ahead** on the sample call if you're short on time.)

**1:35–1:50 · The punchline.** On *Your agent*, let Anna's warm greeting play. Flip to **Cold** and press **Hear your agent**. Flip back to **Warm**.
> "Same agent. One sounds like a phone tree, one sounds like your front desk."

**1:50–2:00 · Booked.** Say your email and role, watch the kickoff form fill itself, and say "yes, send it."
> "In my first two weeks I'd want to put the product in front of practices from the very first click, then measure how many demo requests become kickoffs. I'd love to help build that at Prosper."

*If the mic acts up during recording, click a preset (Dermatology is the best one). It runs the same flow on its own.*

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
