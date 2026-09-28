# Aura Skincare — AI Voice CX Agent ("Aria")

A browser-based AI voice customer support agent for a fictional D2C skincare brand, built for the DataStraw AI Voice Agent assessment.

- **Live app:** https://aura-voice-agent-peach.vercel.app
- **Open in Google Chrome (desktop)** and allow microphone access. Firefox and Safari do not support the browser speech recognition used here.

## What it does

- Natural voice conversation with "Aria" (Start Call / End Call, live state: Listening / Thinking / Speaking, typing dots while thinking)
- Answers using Aura Skincare's shipping, return, cancellation and COD policies, and refuses requests outside policy
- Looks up live order details through a `get_order_details` tool (ORD-101, ORD-102, ORD-103)
- Handles missing or invalid order IDs, unclear audio, and out-of-scope requests without making things up
- English and Hindi/Hinglish (language toggle; Aria replies in the language the customer uses)
- After the call: full transcript and a structured JSON outcome
- "Test Orders Helper" panel on the page so the sample orders can be tried immediately

## Architecture

A modular pipeline, built on free tiers:

1. **Speech to text:** the browser's built-in `SpeechRecognition` (Chrome/Edge).
2. **Reasoning and tool use:** the text goes to `/api/chat` (Next.js API route), which calls Google Gemini (free tier). Aria's persona and the brand policies are sent as system instructions, and `get_order_details` is registered as a tool.
3. **Tool call:** when the customer asks about an order, Gemini decides to call the tool. The server runs the lookup on the mock database, sends the result back to Gemini, and returns one final natural-language reply.
4. **Text to speech:** the browser's built-in `speechSynthesis` speaks the reply, then listening restarts.
5. **Post-call summary:** the transcript is sent to `/api/summarize`, which asks Gemini for the structured JSON.

```
app/page.js                 UI + speech recognition/synthesis + call loop
app/api/chat/route.js       Gemini call, tool-calling loop, retry + graceful fallback
app/api/summarize/route.js  Post-call JSON summary (with fallback)
lib/orders.js               Mock order database + get_order_details tool
lib/prompt.js               Aria's persona and brand policies (guardrails)
```

**How the agent decides to use the tool:** the tool's name, description and parameters are given to Gemini; the model itself decides when a customer message needs an order lookup. If no order ID was given, the prompt tells it to ask for one first.

**How guardrails work:** the policies and the "what you must not do" rules live in the system prompt (`lib/prompt.js`). The order data always comes from the tool, never from the model's memory.

**Graceful degradation:** automatic retry on temporary Gemini errors (429/503), a spoken fallback line instead of raw errors, a locally generated summary if Gemini is unreachable, and an instant local reply to "thank you / bye" (no API call).

## Setup

```bash
npm install
cp .env.example .env.local     # paste your free Gemini key
npm run dev
```

Get a free key (no credit card) at https://aistudio.google.com. Open `http://localhost:3000` in Chrome.

Deployment: push to GitHub, import into Vercel, add `GEMINI_API_KEY` as an environment variable, deploy.

## Test scenarios I ran

| Say this | Expected |
|---|---|
| "Where is my order ORD-101?" | Out for delivery, BlueDart, expected by 6 PM today |
| "Mera order kahan hai" then "101" | Asks for the ID, then answers in Hinglish |
| "I opened it 20 days ago, can I return it?" | Polite refusal citing the 7-day, unopened policy |
| "Cancel ORD-101" / "Cancel ORD-103" | Refused (out for delivery) / allowed (processing) |
| "Any delivery charge?" | Free above ₹499, ₹50 below |
| "Book me a flight to Goa" | Only helps with Aura Skincare queries |
| "Track ORD-999" | Says no such order, asks to verify the ID |
| "Thank you" | Closing line in the customer's language |

## Known limitations (honest)

- Turn-based, not fully real-time: there is no barge-in (the customer cannot interrupt mid-sentence).
- Voice quality depends on the voices installed in the browser/OS, so it is less natural than a dedicated speech model.
- Chrome/Edge desktop only.
- The free Gemini tier has a low request limit (only a few requests per minute and a daily cap), so during heavy use Aria may say she is having trouble and ask the customer to try again.
- Spoken order IDs can be misheard; there is no fuzzy matching yet.

## Section 9 — How I think

**1. Why did you choose this architecture and stack?**
I started with OpenAI's Realtime speech-to-speech API because it gives the most natural feel, but it needs paid billing and I did not have budget for it (it returned a 429 error). So I switched to a modular pipeline, which the assignment allows: browser speech recognition, Gemini with tool calling, and browser speech synthesis. Everything runs on free tiers. I used Next.js because I already work with React/Next.js, and it lets the UI and the small backend live in one project that deploys to Vercel easily. The trade-off is less natural voice and no barge-in, which I have listed above.

**2. What was the most difficult part, and how did you solve it?**
Making tool calling reliable on a free tier. Two problems came up. First, the newer Gemini model rejected my follow-up request with a 400 error about a missing `thought_signature`, because I was rebuilding the model's function-call message myself. The fix was to pass back the model's original response parts unchanged. Second, the free-tier limits caused 429 and 503 errors during testing. I added retries, made every failure turn into a polite spoken fallback instead of a raw error, built a fallback summary, and added a local reply for "thank you / bye" so simple closings never use the API.

**3. If you had one more week, what would you improve first and why?**
Interruption handling (barge-in) and a more natural voice, because they affect how a call feels the most. After that: handling spoken order IDs better (for example "one zero one"), and a set of automated test conversations that check the policy answers, so I can change the prompt without breaking behaviour.

**4. If this agent handled 1,000 conversations a day, what would change?**
Move to a paid API tier with proper rate limits and a fallback provider; use a real database instead of the mock file; verify the customer's identity before sharing order details (right now anyone who knows an order ID can ask about it); add logging and monitoring for every call (latency, errors, cost, resolution rate); add automated evaluations of policy answers; add a handoff to a human agent for cases the AI cannot resolve; and track cost per call.

## How I built this

I used AI coding tools (Claude) to help write and debug the code, as the assignment encourages, and I went through each file to understand what it does and why.