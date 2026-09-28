# Aura Skincare — AI Voice CX Agent

A browser-based voice customer support agent ("Aria") for a fictional D2C
skincare brand, built for the DataStraw AI Voice Agent assessment.

**This build uses a 100% free stack — no paid API required to run it.**

## What's inside

```
app/
  page.js                 -> The whole UI + speech recognition/synthesis logic
  layout.js                -> Next.js root layout
  globals.css              -> Styling
  api/chat/route.js        -> Talks to Gemini, runs the order-lookup tool
  api/summarize/route.js   -> Turns the transcript into structured JSON
lib/
  orders.js                -> Mock order database + get_order_details tool
  prompt.js                -> Aria's persona + Aura Skincare's brand policies
```

## How it works (architecture)

This is a **modular pipeline** (one of the approaches the assignment
explicitly allows): Speech-to-Text -> LLM reasoning & tool execution ->
Text-to-Speech, deliberately built entirely on free tiers:

1. The browser's own built-in `SpeechRecognition` API listens to the
   customer and turns speech into text — no API, no cost.
2. That text is sent to our `/api/chat` route, which calls **Google
   Gemini's free API tier** (`gemini-2.5-flash`, no credit card required)
   with Aria's persona/policies as system instructions and
   `get_order_details` registered as a callable tool.
3. If Gemini decides it needs order info, our server runs the lookup
   against the mock database itself and asks Gemini again with the
   result, so the browser only ever receives one final, natural-language
   reply.
4. The browser speaks that reply using its own built-in
   `speechSynthesis` API — again, no API, no cost — then starts
   listening for the next sentence.
5. When the call ends, the full transcript is sent to Gemini once more
   to produce the structured JSON summary.

## Setup

```bash
npm install
cp .env.example .env.local   # then paste your free Gemini key in
npm run dev
```

Get a free key (no credit card): go to **aistudio.google.com**, sign in
with any Google account, click **"Get API key"** in the left sidebar,
create one, and paste it into `.env.local`.

Open `http://localhost:3000` in **Google Chrome** (required — Chrome has
the best support for browser speech recognition), click **Start Call**,
and allow microphone access.

## Deploying

1. Push this folder to a new GitHub repo.
2. Import it into [Vercel](https://vercel.com/new).
3. In Vercel's project settings, add an environment variable:
   `GEMINI_API_KEY` = your free key.
4. Deploy — Vercel gives you a public URL automatically.

## Testing

Use the sample order IDs shown in the "Test Orders Helper" panel on the
page: `ORD-101`, `ORD-102`, `ORD-103`. Try saying:

- "Where is my order ORD-101?" (out for delivery)
- "I want to cancel ORD-102" (should be refused — already delivered)
- "Can I return a product I opened 20 days ago?" (should be refused per policy)
- "Can you book me a flight to Goa?" (should be politely declined as out of scope)

## Section 9 — How I think about this

*(Personalize these before submitting — these are an honest starting point
based on how this project was actually built.)*

**1. Why this architecture and stack?**
I chose a modular pipeline (browser speech recognition -> LLM with tool
calling -> browser speech synthesis) built entirely on free tiers —
Google Gemini's free API and the browser's own built-in speech APIs —
rather than a paid speech-to-speech API. This was a deliberate cost
trade-off: it sacrifices some of the fluidity of a native voice-to-voice
model (turn-taking is more explicit, and there's no true mid-sentence
barge-in), but it demonstrates the same core requirements — natural
conversation, tool use, guardrails, and graceful degradation — at zero
running cost, which matters for a real early-stage product decision.

**2. What was the hardest part?**
Getting the tool-calling round trip right: recognizing when Gemini wants
order details, running that lookup on the server, and feeding the result
back in the exact format Gemini expects so it can continue the
conversation naturally instead of stalling or repeating itself.

**3. With one more week, what would I improve first?**
Barge-in / interruption handling (letting the customer cut the agent off
mid-sentence), smarter handling of partial or misheard order IDs (fuzzy
matching instead of exact match), and evaluating whether a paid
speech-to-speech API would be worth the cost for a smoother, lower-latency
experience in production.

**4. Scaling to 1,000 conversations/day?**
Replace the in-memory mock database with a real one, add proper logging
and monitoring for every call, add rate-limiting and cost tracking on the
Gemini usage (free tier would need a paid upgrade at real scale), and
consider whether a managed voice AI platform becomes more cost-effective
than the free browser-based approach once volume is high.

## Notes

- Speech recognition currently only works reliably in **Chrome** and
  **Edge** — Firefox and Safari have limited or no support for the
  Web Speech API. The app detects this and shows a message if unsupported.
- Voice quality depends on your OS's installed text-to-speech voices; the
  app tries to pick an `en-IN` voice automatically if one is available on
  your system.
- Google's Gemini free tier has daily/per-minute request limits — more
  than enough for a demo, but if you hit a 429 during testing, wait a
  minute and try again.
