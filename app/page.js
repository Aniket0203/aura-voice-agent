// "use client";

// // app/page.js
// //
// // This version uses ZERO paid APIs for voice:
// // - Speech-to-text: the browser's own built-in SpeechRecognition (free,
// //   works in Chrome/Edge — no API key, no cost).
// // - The "brain": Google Gemini's free API tier (no credit card needed)
// //   via our own /api/chat route, which also runs the order-lookup tool.
// // - Text-to-speech: the browser's own built-in speechSynthesis (free).
// //
// // This is a "modular pipeline" architecture (STT -> LLM -> TTS), which the
// // assignment explicitly lists as an acceptable approach — chosen here
// // specifically because it costs nothing to run.

// import { useRef, useState, useEffect } from "react";
// import { ORDERS } from "../lib/orders";

// export default function Home() {
//   const [callState, setCallState] = useState("idle"); // idle | listening | thinking | speaking | ended
//   const [transcript, setTranscript] = useState([]); // [{ role: 'user' | 'model', text }]
//   const [summary, setSummary] = useState(null);
//   const [error, setError] = useState(null);
//   const [supported, setSupported] = useState(true);

//   const recognitionRef = useRef(null);
//   const callActiveRef = useRef(false);
//   const transcriptRef = useRef([]); // mirror of transcript, for use inside callbacks
//   const voiceRef = useRef(null);

//   // Check the browser actually supports SpeechRecognition (Chrome/Edge do;
//   // Firefox/Safari mostly don't).
//   useEffect(() => {
//     const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
//     if (!SR) setSupported(false);

//     // Voices load asynchronously — grab a good one once available.
//     function pickVoice() {
//       const voices = window.speechSynthesis?.getVoices() || [];
//       voiceRef.current =
//         voices.find((v) => v.lang === "en-IN") ||
//         voices.find((v) => v.lang?.startsWith("en")) ||
//         voices[0] ||
//         null;
//     }
//     pickVoice();
//     window.speechSynthesis?.addEventListener("voiceschanged", pickVoice);
//     return () =>
//       window.speechSynthesis?.removeEventListener("voiceschanged", pickVoice);
//   }, []);

//   function addTranscriptLine(role, text) {
//     if (!text) return;
//     setTranscript((prev) => {
//       const next = [...prev, { role, text }];
//       transcriptRef.current = next;
//       return next;
//     });
//   }

//   // ---- START CALL ----
//   function startCall() {
//     setError(null);
//     setSummary(null);
//     setTranscript([]);
//     transcriptRef.current = [];
//     callActiveRef.current = true;
//     startListening();
//   }

//   // ---- one "turn" of listening ----
//   function startListening() {
//     if (!callActiveRef.current) return;

//     const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
//     const recognition = new SR();
//     recognition.lang = "en-IN"; // falls back gracefully if unavailable
//     recognition.interimResults = false;
//     recognition.continuous = false;
//     recognitionRef.current = recognition;

//     recognition.onstart = () => setCallState("listening");

//     recognition.onresult = (event) => {
//       const said = event.results[0][0].transcript;
//       handleCustomerSpeech(said);
//     };

//     recognition.onerror = (event) => {
//       // "no-speech" just means silence — restart listening rather than erroring out.
//       if (event.error === "no-speech" && callActiveRef.current) {
//         startListening();
//         return;
//       }
//       console.error("Recognition error:", event.error);
//       setError(`Microphone/recognition error: ${event.error}`);
//     };

//     recognition.onend = () => {
//       // If nothing was recognized and the call is still active, listen again.
//       // (handleCustomerSpeech drives the next startListening() call itself
//       // after the agent finishes speaking, so we only auto-restart here for
//       // silent timeouts, not after a real exchange.)
//     };

//     recognition.start();
//   }

//   // ---- customer finished a sentence: send to our AI brain ----
//   async function handleCustomerSpeech(said) {
//     addTranscriptLine("user", said);
//     setCallState("thinking");

//     try {
//       const res = await fetch("/api/chat", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           history: transcriptRef.current.slice(0, -1), // everything except the line we just added
//           message: said,
//         }),
//       });
//       const data = await res.json();

//       if (!res.ok) throw new Error(data.error || "Chat request failed");

//       addTranscriptLine("model", data.text);
//       speak(data.text);
//     } catch (err) {
//       console.error(err);
//       setError(err.message || "Something went wrong talking to the AI.");
//       if (callActiveRef.current) startListening();
//     }
//   }

//   // ---- speak the agent's reply, then listen again ----
//   function speak(text) {
//     setCallState("speaking");
//     const utterance = new SpeechSynthesisUtterance(text);
//     if (voiceRef.current) utterance.voice = voiceRef.current;
//     utterance.onend = () => {
//       if (callActiveRef.current) startListening();
//     };
//     window.speechSynthesis.speak(utterance);
//   }

//   // ---- END CALL ----
//   async function endCall() {
//     callActiveRef.current = false;
//     recognitionRef.current?.stop();
//     window.speechSynthesis?.cancel();
//     setCallState("ended");
//     await generateSummary();
//   }

//   async function generateSummary() {
//     const plainText = transcriptRef.current
//       .map(
//         (line) => `${line.role === "user" ? "Customer" : "Aria"}: ${line.text}`,
//       )
//       .join("\n");
//     if (!plainText) return;

//     try {
//       const res = await fetch("/api/summarize", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ transcript: plainText }),
//       });
//       const data = await res.json();
//       setSummary(data);
//     } catch (err) {
//       console.error(err);
//     }
//   }

//   const stateLabel = {
//     idle: "Not connected",
//     listening: "Listening",
//     thinking: "Thinking",
//     speaking: "Speaking",
//     ended: "Call ended",
//   }[callState];

//   return (
//     <div className="container">
//       <h1>Aura Skincare — Voice Support (Aria)</h1>
//       <p className="subtitle">
//         AI Voice CX Agent demo — free-stack build (browser speech + Gemini)
//       </p>

//       {!supported && (
//         <div className="card" style={{ borderColor: "#b3403a" }}>
//           <p style={{ color: "#b3403a" }}>
//             Your browser doesn't support speech recognition. Please open this
//             page in Google Chrome or Microsoft Edge on desktop.
//           </p>
//         </div>
//       )}

//       <div className="card">
//         <div className="controls">
//           <button
//             className="btn-start"
//             onClick={startCall}
//             disabled={
//               !supported ||
//               ["listening", "thinking", "speaking"].includes(callState)
//             }
//           >
//             Start Call
//           </button>
//           <button
//             className="btn-end"
//             onClick={endCall}
//             disabled={
//               !["listening", "thinking", "speaking"].includes(callState)
//             }
//           >
//             End Call
//           </button>

//           <span className="status-pill">
//             <span className={`dot ${callState}`} />
//             {stateLabel}
//           </span>
//         </div>
//         {error && <p style={{ color: "#b3403a", marginTop: 12 }}>{error}</p>}
//       </div>

//       <div className="card">
//         <h3>Test Orders Helper</h3>
//         <table>
//           <thead>
//             <tr>
//               <th>Order ID</th>
//               <th>Customer</th>
//               <th>Product</th>
//               <th>Value</th>
//               <th>Status</th>
//               <th>Notes</th>
//             </tr>
//           </thead>
//           <tbody>
//             {Object.values(ORDERS).map((o) => (
//               <tr key={o.order_id}>
//                 <td>{o.order_id}</td>
//                 <td>{o.customer}</td>
//                 <td>{o.product}</td>
//                 <td>{o.value}</td>
//                 <td>{o.status}</td>
//                 <td>{o.notes}</td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>

//       <div className="card">
//         <h3>Call Transcript</h3>
//         <div className="transcript">
//           {transcript.length === 0 && (
//             <p style={{ color: "#999" }}>No conversation yet.</p>
//           )}
//           {transcript.map((line, i) => (
//             <div
//               key={i}
//               className={`msg ${line.role === "user" ? "customer" : "agent"}`}
//             >
//               {line.text}
//             </div>
//           ))}
//           {callState === "thinking" && (
//             <div className="msg agent typing">
//               <span></span>
//               <span></span>
//               <span></span>
//             </div>
//           )}
//         </div>
//       </div>

//       {summary && (
//         <div className="card">
//           <h3>Structured Call Outcome</h3>
//           <pre>{JSON.stringify(summary, null, 2)}</pre>
//         </div>
//       )}
//     </div>
//   );
// }
"use client";

// app/page.js
//
// This version uses ZERO paid APIs for voice:
// - Speech-to-text: the browser's own built-in SpeechRecognition (free,
//   works in Chrome/Edge — no API key, no cost).
// - The "brain": Google Gemini's free API tier (no credit card needed)
//   via our own /api/chat route, which also runs the order-lookup tool.
// - Text-to-speech: the browser's own built-in speechSynthesis (free).
//
// This is a "modular pipeline" architecture (STT -> LLM -> TTS), which the
// assignment explicitly lists as an acceptable approach — chosen here
// specifically because it costs nothing to run.

import { useRef, useState, useEffect } from "react";
import { ORDERS } from "../lib/orders";

// If the customer just says "thank you" / "bye", reply with a closing line
// right in the browser — no API call needed. This is instant, saves free-tier
// quota, and still works when Gemini is busy. Returns null for anything else.
function getClosingReply(text, lang) {
  const t = text.toLowerCase().trim();
  if (t.split(/\s+/).length > 6) return null; // long sentence = probably a real question
  if (/order|ord|return|cancel|refund|kahan|kab|where|when|how|\?/.test(t)) return null;

  const hindi = /dhanyavad|dhanyawad|shukriya|alvida|धन्यवाद|शुक्रिया|अलविदा/.test(t);
  const english = /\b(thank you|thanks|thankyou|bye|goodbye|that's all|that is all)\b/.test(t);

  if (hindi) {
    return lang === "hi-IN"
      ? "Aura Skincare में कॉल करने के लिए धन्यवाद! आपका दिन शुभ हो।"
      : "Aura Skincare mein call karne ke liye dhanyavaad! Aapka din shubh ho.";
  }
  if (english) return "Thank you for calling Aura Skincare! Have a great day.";
  return null;
}

export default function Home() {
  const [callState, setCallState] = useState("idle"); // idle | listening | thinking | speaking | ended
  const [transcript, setTranscript] = useState([]); // [{ role: 'user' | 'model', text }]
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef(null);
  const callActiveRef = useRef(false);
  const transcriptRef = useRef([]); // mirror of transcript, for use inside callbacks
  const voiceRef = useRef(null);
  const [language, setLanguage] = useState("en-IN"); // "en-IN" or "hi-IN"
  const languageRef = useRef("en-IN"); // mirror of language, for use inside callbacks

  function changeLanguage(lang) {
    setLanguage(lang);
    languageRef.current = lang;
    pickVoiceForLanguage(lang);
  }

  function pickVoiceForLanguage(lang) {
    const voices = window.speechSynthesis?.getVoices() || [];
    voiceRef.current =
      voices.find((v) => v.lang === lang) ||
      voices.find((v) => v.lang?.startsWith(lang.split("-")[0])) ||
      voices[0] ||
      null;
  }

  // Check the browser actually supports SpeechRecognition (Chrome/Edge do;
  // Firefox/Safari mostly don't).
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setSupported(false);

    // Voices load asynchronously — grab a good one once available.
    function pickVoice() {
      pickVoiceForLanguage(languageRef.current);
    }
    pickVoice();
    window.speechSynthesis?.addEventListener("voiceschanged", pickVoice);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", pickVoice);
  }, []);

  function addTranscriptLine(role, text) {
    if (!text) return;
    setTranscript((prev) => {
      const next = [...prev, { role, text }];
      transcriptRef.current = next;
      return next;
    });
  }

  // ---- START CALL ----
  function startCall() {
    setError(null);
    setSummary(null);
    setTranscript([]);
    transcriptRef.current = [];
    callActiveRef.current = true;
    startListening();
  }

  // ---- one "turn" of listening ----
  function startListening() {
    if (!callActiveRef.current) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = languageRef.current; // "en-IN" or "hi-IN", switchable mid-call
    recognition.interimResults = false;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => setCallState("listening");

    recognition.onresult = (event) => {
      const said = event.results[0][0].transcript;
      handleCustomerSpeech(said);
    };

    recognition.onerror = (event) => {
      // "no-speech" just means silence — restart listening rather than erroring out.
      if (event.error === "no-speech" && callActiveRef.current) {
        startListening();
        return;
      }
      console.error("Recognition error:", event.error);
      setError(`Microphone/recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      // If nothing was recognized and the call is still active, listen again.
      // (handleCustomerSpeech drives the next startListening() call itself
      // after the agent finishes speaking, so we only auto-restart here for
      // silent timeouts, not after a real exchange.)
    };

    recognition.start();
  }

  // ---- customer finished a sentence: send to our AI brain ----
  async function handleCustomerSpeech(said) {
    addTranscriptLine("user", said);

    // "Thank you" / "bye" -> instant local closing line, no API call.
    const closing = getClosingReply(said, languageRef.current);
    if (closing) {
      addTranscriptLine("model", closing);
      speak(closing);
      return;
    }

    setCallState("thinking");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: transcriptRef.current.slice(0, -1), // everything except the line we just added
          message: said,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Chat request failed");

      if (data.debug) {
        // The REAL reason Gemini couldn't answer — check here (F12 console)
        // whenever the agent gives its "having trouble" fallback reply.
        console.error("Gemini debug info:", data.debug);
      }

      addTranscriptLine("model", data.text);
      speak(data.text);
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong talking to the AI.");
      if (callActiveRef.current) startListening();
    }
  }

  // ---- speak the agent's reply, then listen again ----
  function speak(text) {
    setCallState("speaking");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languageRef.current;
    if (voiceRef.current) utterance.voice = voiceRef.current;
    utterance.onend = () => {
      if (callActiveRef.current) startListening();
    };
    window.speechSynthesis.speak(utterance);
  }

  // ---- END CALL ----
  async function endCall() {
    callActiveRef.current = false;
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    setCallState("ended");
    await generateSummary();
  }

  async function generateSummary() {
    const plainText = transcriptRef.current
      .map((line) => `${line.role === "user" ? "Customer" : "Aria"}: ${line.text}`)
      .join("\n");
    if (!plainText) return;

    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: plainText }),
      });
      const data = await res.json();
      setSummary(data);
    } catch (err) {
      console.error(err);
    }
  }

  const stateLabel = {
    idle: "Not connected",
    listening: "Listening",
    thinking: "Thinking",
    speaking: "Speaking",
    ended: "Call ended",
  }[callState];

  return (
    <div className="container">
      <h1>Aura Skincare — Voice Support (Aria)</h1>
      <p className="subtitle">AI Voice CX Agent demo — free-stack build (browser speech + Gemini)</p>

      {!supported && (
        <div className="card" style={{ borderColor: "#b3403a" }}>
          <p style={{ color: "#b3403a" }}>
            Your browser doesn't support speech recognition. Please open this page in
            Google Chrome or Microsoft Edge on desktop.
          </p>
        </div>
      )}

      <div className="card">
        <div className="controls">
          <button
            className="btn-start"
            onClick={startCall}
            disabled={!supported || ["listening", "thinking", "speaking"].includes(callState)}
          >
            Start Call
          </button>
          <button
            className="btn-end"
            onClick={endCall}
            disabled={!["listening", "thinking", "speaking"].includes(callState)}
          >
            End Call
          </button>

          <span className="status-pill">
            <span className={`dot ${callState}`} />
            {stateLabel}
          </span>

          <span className="controls" style={{ marginLeft: "auto" }}>
            <button
              onClick={() => changeLanguage("en-IN")}
              style={{
                background: language === "en-IN" ? "#2b2620" : "#f1ede4",
                color: language === "en-IN" ? "white" : "#2b2620",
                padding: "8px 16px",
              }}
            >
              English
            </button>
            <button
              onClick={() => changeLanguage("hi-IN")}
              style={{
                background: language === "hi-IN" ? "#2b2620" : "#f1ede4",
                color: language === "hi-IN" ? "white" : "#2b2620",
                padding: "8px 16px",
              }}
            >
              हिन्दी
            </button>
          </span>
        </div>
        {error && <p style={{ color: "#b3403a", marginTop: 12 }}>{error}</p>}
      </div>

      <div className="card">
        <h3>Test Orders Helper</h3>
        <table>
          <thead>
            <tr><th>Order ID</th><th>Customer</th><th>Product</th><th>Status</th></tr>
          </thead>
          <tbody>
            {Object.values(ORDERS).map((o) => (
              <tr key={o.order_id}>
                <td>{o.order_id}</td>
                <td>{o.customer}</td>
                <td>{o.product}</td>
                <td>{o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Call Transcript</h3>
        <div className="transcript">
          {transcript.length === 0 && <p style={{ color: "#999" }}>No conversation yet.</p>}
          {transcript.map((line, i) => (
            <div key={i} className={`msg ${line.role === "user" ? "customer" : "agent"}`}>
              {line.text}
            </div>
          ))}
          {callState === "thinking" && (
            <div className="msg agent typing">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
        </div>
      </div>

      {summary && (
        <div className="card">
          <h3>Structured Call Outcome</h3>
          <pre>{JSON.stringify(summary, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

