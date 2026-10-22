# Prosper Voice Onboarder

**Live:** [prosper-voice-onboarder.pages.dev](https://prosper-voice-onboarder.pages.dev)

A practice leader talks to a Prosper agent for about a minute. While they talk, it builds their AI front desk: which agents they need, their EHR, their call volume, and how their front desk makes patients feel welcome. Then it plays their own agent greeting a patient at their practice, and hands sales a complete lead brief.

This is an unofficial concept by [Abdul Saboor Shaikh](https://abdulsaboorshaikh.com) ([LinkedIn](https://linkedin.com/in/abdulsaboorshaikh)), built as the experiment I'd want to run in my first two weeks at Prosper. All data is mock: no PHI, no EHR integration, and nothing is stored or sent.

## The idea

Prosper sells voice agents, and the homepage already invites people to "Call to try Prosper AI's agent live." But that line gives every caller the same generic demo, and sales learns nothing from the call. For everyone else, the first touch is the Get Started form. On the Use Cases page, only Anna has a recording.

The onboarder turns "try our agent" into a demo of **your** practice that also qualifies the lead:

- **The prospect** hears the product on their own practice: Anna greets *their* patient, by name, with *their* warmth rules. That's a stronger first impression than a form or a generic demo line.
- **Sales** gets more than a form ever captures: specialty and size, EHR, call volume and peak hours, which agents to deploy, how the front desk talks to patients, when a patient must always get a human, and a suggested demo opener.
- **The Agent Manager** starts Week 1 of the 3-week launch with the guidelines half-written.

The demo form stays. This is for the visitor who isn't ready to book yet.

## The experiment

| | |
|---|---|
| **Hypothesis** | Visitors who aren't ready for a demo leave today. A "hear it on your practice" call next to Get Started converts some of them into demo requests, and the leads arrive richer. |
| **Test** | A/B test a "Talk to a Prosper agent" entry point on the homepage and Use Cases page against the current experience. |
| **Primary metric** | Visitor to demo-request conversion. |
| **Secondary metrics** | Percent of demo requests that arrive with a complete brief; time from first touch to kickoff; demo-to-close rate for voice-sourced leads. |
| **Production version** | Runs on Prosper's own agent stack and voices, so the onboarding call *is* the product. |

## What happens on the call

1. **About your practice:** name, specialty, size, EHR.
2. **Your calls:** which calls eat the front desk's day, when it hurts most, how many.
3. **Warmth:** how the front desk welcomes patients, when a patient must always be offered a human, languages.
4. **Your team:** the matching agents join one by one (Anna, Kate, Alex, ...). The guide offers a short sample call.
5. **Your agent:** Anna greets a patient at your practice using your warmth rules. A **Cold / Warm** toggle plays the same greeting the way a phone tree would say it.
6. **Kickoff:** the guide fills in the kickoff request from the conversation, asks for an email and role, and sends it.
7. **The lead brief** shows what Prosper's sales team receives, including how long it took to capture by voice.

The right pane is read-only and labeled *Built live by Prosper Guide*. The visitor never fills in a field; the conversation does. Typing is available as a fallback, and three sample practices (Dermatology, OB-GYN, GI) run the whole call automatically.

## How it works

| Piece | Implementation |
|---|---|
| Listening | Chrome's Web Speech API, hands-free. A turn ends after one second of silence; the mic button interrupts the guide or ends a turn early. |
| Understanding | Each reply is understood instantly by keyword rules, so the guide answers right away. In parallel, Llama 3.3 70B on Workers AI (`functions/api/turn.ts`, JSON mode) re-reads the reply and corrects the profile, for example by fixing a misheard practice name. The guide only waits for the model when the keyword rules can't make sense of an answer. |
| Speaking | Deepgram Aura-2 on Workers AI (`functions/api/tts.ts`), with a different voice per agent. The guide's reply is built from the live transcript and its audio is fetched while the user is still talking; scripted lines are fetched ahead of time and cached at the edge. Falls back to the browser's voice. |
| Agent actions | The guide drives the page: it switches views, highlights each agent as it introduces them, plays sample calls and the greeting, and fills in the kickoff request. |
| Hosting | Cloudflare Pages + Pages Functions. No database, nothing persisted. |

Add `?debug` to the URL to see per-turn latency: the silence wait, time to the guide's first audio, and when the model's correction landed.

## Agents

| Call type | Agent | Role |
|---|---|---|
| Scheduling | Anna | Appointment Scheduling |
| Billing questions | Emma, Ben | Inbound Billing Questions, Patient Balance Reminders |
| Reminders | Tom | Appointment Reminders |
| Switchboard | Jack | Switchboard |
| Benefits verification | Alex | Benefits Verification |
| Prior auth | Kate | Prior Authorization |
| Claims & denials | Lucy, Mary | Claim Follow-up, Denial Follow-up |
| Refills | James | Prescription Refills |
| Recalls | Sara | Re-Engagement Campaigns |

Names and roles are from getprosper.ai. Payer-side agents are left out because this onboards a provider practice. Sample calls are illustrative.

## Code

```
src/
  App.tsx         call screen and conversation runner
  RightPane.tsx   live setup, team, agent greeting, kickoff and lead brief
  flow.ts         questions, keyword understanding, spoken acknowledgements
  brain.ts        background model call
  voice.ts        Aura-2 playback and hands-free speech recognition
  data.ts         agents, call types, sample practices and scripts
functions/api/
  turn.ts         Workers AI understanding (Llama 3.3 70B, JSON mode)
  tts.ts          Workers AI text-to-speech (Aura-2) with edge caching
```
