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

const BASE_PRIVATE_FACTS = `
- Tanmay's Mother's name: "[Mamta sahu]"
- Tanmay's Father's name: "[Pramod Sahu]"
- Tanmay's sister's name: "[Geet Sahu]"
- Tanmay's Grandfather's name: "[Suresh sahu]"
- Tanmay's Grandmother's name: "[Indra sahu]"
- Tanmay's maternal grandfather's name: "[durda prasad sahu]"
- Tanmay's maternal grandmother's name: "[anasuya sahu]"
- Tanmay's cousin's name (chacha ke bacche): "[Prasoon sahu, kartavya sahu]"
- Tanmay's cousin's name (mausi ke bacche): "[bhavesh sahu, sohil sahu]"
- Tanmay's uncle's name (chacha): "[Pawan sahu]"
- Tanmay's aunt's name (chachi): "[Anita sahu]"
- Tanmay's aunt's name (mausi): "[krishna sahu]"
- Tanmay's uncle's name (mausa): "[anil sahu]"
- Tanmay's Maternal uncle's name (mama): "[manesh sahu, mukesh sahu]"
- Tanmay's Maternal aunt's name (mami): "[dalee sahu, vidhya sahu]"
- Tanmay's Maternal cousins: "[bhumi sahu, udit sahu, pihu sahu, rahi sahu]"
- Tanmay's Birthday: "[29th July 2009, 17 years old]"
- Tanmay's Home Town: "[jhurre colony, Madhya Pradesh]"
- Tanmay's School: "[Flower vale high school (past), Excellence govt. school (current)]"
- Mama Manesh job: "[Locopilot]"
- Mama Mukesh job: "[Army Officer]"
`;

function buildSystemPrompt(userName, isAdmin, globalRules = [], personalMemory = []) {
  const globalRulesStr = globalRules.length > 0 ? globalRules.map(r => `* ${r}`).join("\n") : "None";
  const personalMemoryStr = personalMemory.length > 0 ? personalMemory.map(m => `* ${m}`).join("\n") : "None";

  return `You are Tanmay AI, a helpful, polite, and intelligent AI assistant.

USER CONTEXT:
- Talking with: "${userName}"
- Admin/Creator: ${isAdmin ? "YES (Tanmay Sahu)" : "NO"}

🔥 CRITICAL LIVE OVERRIDES (TOP PRIORITY - ALWAYS FOLLOW FIRST):
${globalRulesStr}

USER SPECIFIC MEMORY:
${personalMemoryStr}

KNOWN BASE FACTS:
${BASE_PRIVATE_FACTS}

CORE BEHAVIOR RULES:
1. UNKNOWN INFO POLICY: If the user asks about something specific (e.g. what someone does, their job, private details) that is NOT present in the facts or overrides above, DO NOT give rude robotic refusals. Simply and politely reply: "Mujhe is baare mein abhi jankari nahi hai."
2. Reply in the same language/script the user speaks (Hindi, Hinglish, or English).
3. If asked who created you: "Main Tanmay AI hun, mujhe Tanmay Sahu ne banaya hai."
4. Always prioritize live learned overrides above the base facts.`;
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

    const safeMessages = Array.isArray(messages) && messages.length > 0 
      ? messages 
      : [{ role: "user", content: "Hi" }];

    const allMessages = [{ role: "system", content: systemPromptContent }, ...safeMessages];

    // 1. GROQ (Primary Attempt)
    try {
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: allMessages,
        temperature: 0.5
      });

      const reply = response.choices?.[0]?.message?.content;
      if (reply) return res.json({ reply });
    } catch (err) {
      console.log("Groq fallback triggered:", err.message);
    }

    // 2. GEMINI (Backup Attempt)
    try {
      const model = gemini.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: systemPromptContent
      });

      const contents = safeMessages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content || "Hello" }]
      }));

      const result = await model.generateContent({ contents });
      const reply = result.response.text();
      if (reply) return res.json({ reply });
    } catch (err) {
      console.log("Gemini fallback triggered:", err.message);
    }

    // 3. OPENROUTER (Final Backup)
    try {
      const response = await openrouter.chat.completions.create({
        model: "meta-llama/llama-3.1-8b-instruct:free",
        messages: allMessages
      });

      const reply = response.choices?.[0]?.message?.content;
      if (reply) return res.json({ reply });
    } catch (err) {
      console.log("OpenRouter fallback triggered:", err.message);
    }

    return res.json({ reply: "Mujhe is baare mein abhi jankari nahi hai." });

  } catch (error) {
    console.error("Server execution error:", error);
    return res.json({ reply: "Server se connect karne me dikkat aayi, kripya dobara try karein." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Tanmay AI Server is running properly on port ${PORT}`);
});