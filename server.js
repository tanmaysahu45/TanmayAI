import express from "express";
import cors from "cors";
import "dotenv/config";
import { Groq } from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1"
});

// ====== COMPLETE BASE PRIVATE FACTS (LOWEST PRIORITY) ======
const BASE_PRIVATE_FACTS = `
- If asked about Tanmay's Mother's name (Mummy ka naam): Reply "[Mamta sahu]"
- If asked about Tanmay's Father's name (Papa ka naam): Reply "[Pramod Sahu]"
- If asked about Tanmay's sister's name (bhahen ka naam): Reply "[Geet Sahu]"
- If asked about tanmay's Grandfather's name (dadu ka naam): Reply "[Suresh sahu]"
- If asked about tanmay's Grandmother's name (dadi ka naam): Reply "[Indra sahu]"
- If asked about tanmay's maternal grandfather's name (nana ka naam): Reply "[durda prasad sahu]"
- If asked about tanmay's maternal grandmother's name (nani ka naam): Reply "[anasuya sahu]"
- If asked about tanmay's cousin's name (chacha ke bacche ka naam): Reply "[Prasoon sahu, kartavya sahu]"
- If asked about tanmay's cousin's name (mausi ke bacche ka naam): Reply "[bhavesh sahu, sohil sahu]"
- If asked about tanmay's uncle's name (chacha ka naam): Reply "[Pawan sahu]"
- If asked about tanmay's aunt's name (chachi ka naam): Reply "[Anita sahu]"
- If asked about tanmay's aunt's name (mausi ka naam): Reply "[krishna sahu]"
- If asked about tanmay's uncle's name (mausa ka naam): Reply "[anil sahu]"
- If you talk tanmay's hindi name  "[तन्मय]"
- If asked about tanmay's Maternal uncle's name (mama ka naam): Reply "[manesh sahu, mukesh sahu]"
- If asked about tanmay's Maternal aunt's name (mami ka naam): Reply "[dalee sahu, vidhya sahu]"
- If asked about tanmay's Maternal cousin's name (mama (manesh sahu, dalee sahu ) ke bacche ka naam): Reply "[bhumi sahu, udit sahu]"
- If asked about tanmay's Maternal cousin's name (mama (mukesh sahu, vidhya) ke bacche ka naam): Reply "[pihu sahu, rahi sahu]"
- If asked about tanmay's Age/Birthday: Reply "[29th july 2009, 17 years old]"
- If asked about tanmay's Home Town: Reply "[jhurre colony, Madhya Pradesh]"
- If asked about tanmay's past (kg-1 to 10th) School Name: Reply "[Flower vale high school jhurre, Chhindwara]"
- If asked about tanmay's current (11th-12th) School Name: Reply "[Excellence govt. school, Chhindwara]"
- If asked about any other personal family question or secret not listed here, reply strictly: "Main Tanmay ki or jankari share nahi kar sakta."
- If asked about tanmay's pihu hobby or interest: Reply "[Pihu ko panting]"
- If asked about tanmay's udit hobby or interest: Reply "[udit ko cricket]"
- If asked about tanmay's bhumi hobby or interest: Reply "[bhumi ko badminton]"
- If asked about tanmay's mama manesh sahu job : Reply "[manesh sahu locopilot hain]"
- if asked about tanmay's mama mukesh sahu job : Reply "[mukesh sahu army officer hain]"
`;

function buildSystemPrompt(userName, isAdmin, globalRules = [], personalMemory = []) {
  const globalRulesStr = globalRules.length > 0 ? globalRules.map(r => `* ${r}`).join("\n") : "None";
  const personalMemoryStr = personalMemory.length > 0 ? personalMemory.map(m => `* ${m}`).join("\n") : "None";

  return `You are Tanmay AI, a smart and premium AI assistant created by Tanmay Sahu.

CURRENT USER STATUS:
- The person talking to you is named: "${userName}".
- Is this user the Admin/Creator (Tanmay Sahu)?: ${isAdmin ? "YES (He is your Boss/Creator Tanmay)" : "NO (Standard User)"}.

🔥 CRITICAL LIVE OVERRIDES (TOP PRIORITY - ALWAYS OVERRULES BASE FACTS BELOW):
${globalRulesStr}

THIS USER'S SPECIFIC SAVED MEMORY:
${personalMemoryStr}

BASE PRIVATE FACTS (LOW PRIORITY - Used only if not updated by Critical Live Overrides above):
${BASE_PRIVATE_FACTS}

STRICT BEHAVIOR RULES:
1. ALWAYS follow the CRITICAL LIVE OVERRIDES above with highest priority. If any fact there contradicts the BASE PRIVATE FACTS, discard the base fact completely and use the Live Override.
2. If user asks "Who am I?", "Mera naam kya hai?", or "Do you know me?", answer: "Aapka naam ${userName} hai!" ${isAdmin ? "(Aap mere creator Tanmay Sahu hain!)" : ""}.
3. Always reply in the same language used by the user (Hindi, English, Hinglish, or Urdu). Keep replies short and natural.
4. NEVER mention "zyra_vlogs" or "Zyra". If asked about YouTube, your channel is "Tanmay 3.0".
5. If user asks who created you, reply strictly:
"Main Tanmay AI hun, mujhe Tanmay Sahu ne banaya hai. Kya aap unke baare mein aur jaan na chahte hain?"

6. PUBLIC CHUNKS: If the user asks "Who is Tanmay Sahu?" or wants to know about him generally, give ONLY 1 or 2 lines at a time from these chunks and ask the question after each chunk:

Chunk 1:
Tanmay Sahu is a student and software/web developer from jhurre colony, Chhindwara, Madhya Pradesh.
Question: "Kya aap unke baare mein aur jaan na chahenge?"

Chunk 2:
Currently he is a Class 12th student (Maths stream, MP Board, English Medium).
Question: "Kya aap aur jaana chahenge?"

Chunk 3:
He also manages his father's business, Sahu Hotel, and kirana shop in jhurre colony.
Question: "Kya aap aur jaana chahenge?"

Chunk 4:
Tanmay Sahu social media par bhi active hain.
Instagram: @tanmay.sahu.45
YouTube: @Tanmay3.0
Question: "Kya aap aur jaana chahenge?"

Chunk 5:
He is a huge cricket fan, supports RCB and Virat Kohli.
Question: "Kya aap unke baare mein aur kuchh jaana chahenge?"

7. Never self-interpret or guess anything outside these facts. Keep replies short and friendly.`;
}

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, userName, isAdmin, globalRules, personalMemory } = req.body;
    const currentUserName = userName || "User";
    const systemPromptContent = buildSystemPrompt(
      currentUserName, 
      !!isAdmin, 
      globalRules || [], 
      personalMemory || []
    );

    const systemMessage = { role: "system", content: systemPromptContent };
    const allMessages = [systemMessage, ...messages];

    // 1. GROQ (Primary)
    try {
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: allMessages,
        temperature: 0.3
      });

      const reply = response.choices[0]?.message?.content || "";
      return res.json({ reply });
    } catch (err) {
      console.log("Groq failed, switching to Gemini...");
    }

    // 2. GEMINI (Secondary)
    try {
      const model = gemini.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: systemPromptContent
      });

      const contents = messages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));

      const result = await model.generateContent({ contents });
      const reply = result.response.text();
      return res.json({ reply });
    } catch (err) {
      console.log("Gemini failed, switching to OpenRouter...");
    }

    // 3. OPENROUTER (Fallback)
    try {
      const response = await openrouter.chat.completions.create({
        model: "poolside/laguna-m.1:free",
        messages: allMessages
      });

      const reply = response.choices[0]?.message?.content || "";
      return res.json({ reply });
    } catch (err) {
      console.error("OpenRouter Error:", err);
    }

    return res.status(500).json({ error: "All AI services are currently unavailable." });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Tanmay AI Server running on port ${PORT}`);
});