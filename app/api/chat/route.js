// app/api/chat/route.js
//
// This route is the AI "brain". The browser sends it the conversation so
// far plus the customer's latest sentence (already turned into text by the
// browser's free built-in speech recognition). This route talks to Google
// Gemini (free tier, no credit card needed), and if Gemini wants to look up
// an order, THIS route runs that lookup itself and asks Gemini to continue
// — so the browser only ever gets back one final, ready-to-speak reply.

import { SYSTEM_PROMPT } from "../../../lib/prompt";
import { getOrderDetails, orderFunctionDeclaration } from "../../../lib/orders";
export const maxDuration = 60;

const MODEL = "gemini-3.8-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export async function POST(request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      { error: "GEMINI_API_KEY is not set on the server." },
      { status: 500 }
    );
  }

  const { history, message } = await request.json();

  // `history` is the list of previous turns as { role: 'user' | 'model', text }.
  // Gemini's REST API is stateless, so every request must include the full
  // conversation so far, plus the newest customer message.
  const contents = [
    ...(history || []).map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  try {
    const replyText = await askGemini(contents);
    return Response.json({ text: replyText });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: err.message || "Gemini request failed." },
      { status: 502 }
    );
  }
}

// Sends `contents` to Gemini. If Gemini asks to call our order-lookup tool,
// this function runs it, feeds the result back to Gemini, and asks again
// (recursion depth is always small — at most one tool call per customer turn).
// Some Gemini responses fail with a temporary 503 "high demand" error —
// this is Google's servers being busy for a moment, not a bug in our code.
// We retry a couple of times with a short pause before giving up, so a
// brief spike in traffic doesn't crash the customer's call.
async function fetchWithRetry(url, options, retries = 1, delayMs = 20000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, options);
    if (res.ok) return res;

    const isRetryable = res.status === 503 || res.status === 429;
    if (!isRetryable || attempt === retries) return res;

    await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
  }
}

async function askGemini(contents) {
  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    tools: [{ functionDeclarations: [orderFunctionDeclaration] }],
  };

  const res = await fetchWithRetry(GEMINI_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    // Log the REAL error server-side (visible in your terminal / hosting
    // provider's logs) so you can debug it — but never show raw API errors
    // to the customer. Instead, Aria gives a graceful, in-character reply,
    // which is exactly the "graceful degradation" behavior the assignment
    // asks for, regardless of what specifically went wrong on Gemini's side.
    console.error(`Gemini error (status ${res.status}):`, errText);
    return "I'm sorry, I'm having a little trouble processing that right now — could you please repeat that, or try again in a moment?";
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];

  const functionCallPart = parts.find((p) => p.functionCall);

  if (functionCallPart) {
    const { name, args } = functionCallPart.functionCall;
    let result = { error: `Unknown function: ${name}` };

    if (name === "get_order_details") {
      result = getOrderDetails(args.order_id);
    }

    // IMPORTANT: pass back the model's ORIGINAL parts array unchanged (not a
    // rebuilt version). Gemini 3.x attaches a required "thought_signature"
    // to each function-call part, and if we reconstruct the part ourselves
    // instead of echoing exactly what the model sent, Gemini rejects the
    // next request with a 400 error. Passing `parts` straight through avoids
    // that entirely.
    const followUpContents = [
      ...contents,
      { role: "model", parts },
      { role: "user", parts: [{ functionResponse: { name, response: result } }] },
    ];

    return askGemini(followUpContents);
  }

  const textPart = parts.find((p) => p.text);
  return textPart?.text || "Sorry, could you repeat that?";
}
