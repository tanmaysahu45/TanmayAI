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

// ================== APIs SETUP ==================
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
- Tanmay's Home Town: "[Jhurre colony, Chhindwara, Madhya Pradesh]"
- Tanmay's School: "[Flower vale high school (past), Excellence govt. school (current)]"
- Mama Manesh job: "[Locopilot]"
- Mama Mukesh job: "[Army Officer]"
`;

function buildSystemPrompt(userName, isAdmin, globalRules = [], personalMemory = []) {
  const globalRulesStr = globalRules.length > 0 ? globalRules.map(r => `* ${r}`).join("\n") : "None";
  const personalMemoryStr = personalMemory.length > 0 ? personalMemory.map(m => `* ${m}`).join("\n") : "None";

  return `You are Tanmay AI, an intelligent, smart, and helpful AI assistant created by Tanmay Sahu.

USER INFO:
- Current User: "${userName}"
- Is Admin?: ${isAdmin ? "YES" : "NO"}

🔥 CRITICAL LEARNED RULES (TOP PRIORITY):
${globalRulesStr}

USER SPECIFIC MEMORY:
${personalMemoryStr}

TANMAY'S FAMILY FACTS:
${BASE_PRIVATE_FACTS}

CORE INSTRUCTIONS:
1. GENERAL KNOWLEDGE: You are a highly capable AI. For general questions (like 'Prime Minister of India', math, science, programming, history, etc.), ANSWER NORMALLY AND ACCURATELY. DO NOT say you don't know.
2. PERSONAL IDENTITY: If the user asks "Mera naam kya hai?", answer using their 'Current User' name or 'User Specific Memory'.
3. UNKNOWN FAMILY INFO: ONLY if the user asks a very specific private question about Tanmay's family that is NOT in the facts above, reply with: "Mujhe is baare mein abhi jankari nahi hai."
4. ALWAYS prioritize Critical Learned Rules over everything else.
5. Keep your tone natural and polite. Reply in the same language the user writes (Hindi, English, or Hinglish).`;
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

    // Filter messages to avoid empty context crashes
    const safeMessages = Array.isArray(messages) && messages.length > 0 ? messages : [{ role: "user", content: "Hi" }];
    const allMessages = [{ role: "system", content: systemPromptContent }, ...safeMessages];

    // ----------------- 1. GROQ (FIRST ATTEMPT) -----------------
    try {
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: allMessages,
        temperature: 0.4
      });

      const reply = response.choices[0]?.message?.content || "";
      console.log(`👉 Response delivered by Groq for user: ${currentUserName}`);
      return res.json({ reply });

    } catch (err) {
      console.log("❌ Groq failed, switching to Gemini...");
    }

    // ----------------- 2. GEMINI (SECOND ATTEMPT) -----------------
    try {
      const model = gemini.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: systemPromptContent
      });

      const contents = safeMessages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));

      const result = await model.generateContent({ contents });
      const reply = result.response.text();

      console.log(`👉 Response delivered by Gemini for user: ${currentUserName}`);
      return res.json({ reply });

    } catch (err) {
      console.log("❌ Gemini failed, switching to OpenRouter...");
    }

    // ----------------- 3. OPENROUTER (FINAL BACKUP) -----------------
    try {
      const response = await openrouter.chat.completions.create({
        model: "poolside/laguna-m.1:free",
        messages: allMessages
      });

      const reply = response.choices[0]?.message?.content || "";
      console.log(`👉 Response delivered by OpenRouter for user: ${currentUserName}`);
      return res.json({ reply });

    } catch (err) {
      console.error("❌ OpenRouter Error:", err);
    }

    // अगर सारे AI फेल हो जाएं
    return res.status(500).json({
      reply: "Sabhi AI services abhi unavailable hain. Kripya thodi der baad try karein."
    });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ reply: "Server Error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Tanmay AI Hybrid Server running on port ${PORT}`);
});