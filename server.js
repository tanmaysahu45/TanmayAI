import express from "express";
import cors from "cors";
import "dotenv/config";
import { Groq } from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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
- Tanmay's Home Town: "[Jhurre Colony, Chhindwara, Madhya Pradesh]"
- Tanmay's School: "[Flower Vale High School (past), Excellence Govt. School (current)]"
- Mama Manesh job: "[Locopilot]"
- Mama Mukesh job: "[Army Officer]"
`;

function buildSystemPrompt(userName, isAdmin, globalRules = [], personalMemory = []) {
  const globalRulesStr = globalRules.length > 0 ? globalRules.map(r => `* ${r}`).join("\n") : "None";
  const personalMemoryStr = personalMemory.length > 0 ? personalMemory.map(m => `* ${m}`).join("\n") : "None";

  return `You are Tanmay AI, an intelligent and helpful AI assistant created by Tanmay Sahu.

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
1. GENERAL CONVERSATION: If the user says "Hi", "Hello", asks how you are, or asks general knowledge questions, RESPOND NORMALLY. 
2. PERSONAL IDENTITY: Answer using 'Current User' name.
3. UNKNOWN PRIVATE INFO: ONLY if the user asks a very specific private family question about Tanmay that is NOT in the facts or rules above, reply politely: "Mujhe is baare mein abhi jankari nahi hai."
4. ALWAYS prioritize Critical Learned Rules over the base facts.
5. Keep your tone natural and polite. Reply in the language the user writes (Hindi, English, or Hinglish).`;
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

    const safeMessages = Array.isArray(messages) && messages.length > 0 ? messages : [{ role: "user", content: "Hi" }];
    const allMessagesForGroq = [{ role: "system", content: systemPromptContent }, ...safeMessages];

    // ==========================================
    // 1. MAIN API (GROQ - 100% Stable Free Model)
    // ==========================================
    try {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const response = await groq.chat.completions.create({
        model: "llama3-8b-8192", // Changed to absolute stable model
        messages: allMessagesForGroq,
        temperature: 0.5
      });

      const reply = response.choices[0]?.message?.content;
      if (reply) return res.json({ reply });

    } catch (groqError) {
      console.error("GROQ API ERROR:", groqError.message);
      
      // ==========================================
      // 2. FALLBACK API (GEMINI - Most Stable Version)
      // ==========================================
      try {
        const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Changed to gemini-pro which is universally supported
        const model = gemini.getGenerativeModel({ model: "gemini-pro" });

        // Gemini-pro sometimes fails with direct systemInstructions, so we combine it safely
        const combinedMessages = [
          {
            role: "user",
            parts: [{ text: `SYSTEM PROMPT: ${systemPromptContent}\n\nUSER MESSAGE: ${safeMessages[safeMessages.length - 1].content}` }]
          }
        ];

        const result = await model.generateContent({ contents: combinedMessages });
        const reply = result.response.text();
        
        if (reply) return res.json({ reply });

      } catch (geminiError) {
        console.error("GEMINI API ERROR:", geminiError.message);
        
        // ==========================================
        // 3. OPENROUTER (Guaranteed Free Model)
        // ==========================================
        try {
            const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  model: "mistralai/mistral-7b-instruct:free", // Changed to a model that is permanently free
                  messages: allMessagesForGroq
                })
            });
            
            const data = await openRouterRes.json();
            const reply = data.choices?.[0]?.message?.content;
            if (reply) return res.json({ reply });

        } catch (openRouterError) {
            console.error("OPENROUTER API ERROR:", openRouterError.message);
            return res.json({ reply: "Bhai, sabhi AI companies (Groq, Gemini, OpenRouter) fail ho gayi hain. Render Logs me error check karo." });
        }
      }
    }

  } catch (error) {
    console.error("SERVER CRASH:", error);
    return res.json({ reply: "Server error. Code execute nahi hua." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Tanmay AI Original Structure Server running on port ${PORT}`);
});