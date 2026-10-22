# Hear It at Your Practice

**Live:** [prosper-hear-it.pages.dev](https://prosper-hear-it.pages.dev)

A visitor types their practice name and specialty. Every Prosper agent then plays a short call for *that* practice, with its patients and payers, in its own voice. Anna's greeting has a **Cold / Warm** toggle, so the visitor hears the difference between a phone tree and an agent that sounds like their own front desk.

This is an unofficial concept by [Abdul Saboor Shaikh](https://abdulsaboorshaikh.com) ([LinkedIn](https://linkedin.com/in/abdulsaboorshaikh)). All data is mock: no PHI, and nothing is stored or sent.

## Why

On getprosper.ai, the Use Cases page lists more than a dozen agents, and only Anna has a recording. Everything else leads to the Get Started form or a demo phone number that gives every caller the same generic call.

Competitors are moving on this first touch:

- **Hello Patient** lets visitors talk to an agent in the browser, and a specialty selector swaps in a sample practice.
- **Assort Health** has "Try it now" next to its demo number.

None of them make the demo about the visitor's own practice. This does: every agent, with the visitor's practice name and specialty-specific details, one click each. A dermatology practice hears Kate chase a prior auth for a psoriasis biologic, and a GI practice hears Jack route a question about colonoscopy prep.

## The experiment

| | |
|---|---|
| **Hypothesis** | Hearing the agents on your own practice converts more Use Cases visitors into demo requests than a single recording does. |
| **Test** | A/B test the personalized agent grid against the current Use Cases page. |
| **Primary metric** | Visitor to demo-request conversion. |
| **Secondary metrics** | Agents played per visitor; demo-to-close rate for visitors who played an agent. |
| **Bonus signal** | Which agents a visitor played (front desk vs. payer-side) tells sales what to lead the demo with. The "Book a demo" step shows what that hand-off could look like. |

## How it works

- Sample calls are scripted templates (`src/data.ts`) filled with the practice name and specialty details: the visit type, follow-up, procedure, medication, and when to always offer a human.
- Voices are Deepgram Aura-2 on Cloudflare Workers AI (`functions/api/tts.ts`), with a different voice per agent and separate voices for patients and payers. Each call's opening line is fetched as soon as the practice is entered, and audio is cached at the edge, so playback starts instantly.
- Hosted on Cloudflare Pages with one Pages Function. No database, nothing persisted.

```
src/
  App.tsx       the page: personalization, agent grid, greeting, demo hand-off
  data.ts       agents, specialties, sample call scripts
  voice.ts      Aura-2 playback with a browser-voice fallback
functions/api/
  tts.ts        Workers AI text-to-speech with edge caching
```
