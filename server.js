import express from "express";
import cors from "cors";
import "dotenv/config";
import { Groq } from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ===============================
// AI CLIENTS
// ===============================

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const gemini = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);

const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1"
});

// ===============================
// AI MODELS
// ===============================

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GEMINI_MODEL = "gemini-3.7-flash";
const OPENROUTER_MODEL = "openrouter/free";

// ===============================
// PRIVATE FAMILY FACTS
// ===============================

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

// ===============================
// SYSTEM PROMPT
// ===============================

function buildSystemPrompt(
  userName,
  isAdmin,
  globalRules = [],
  personalMemory = []
) {
  const globalRulesStr =
    globalRules.length > 0
      ? globalRules.map(r => `* ${r}`).join("\n")
      : "None";

  const personalMemoryStr =
    personalMemory.length > 0
      ? personalMemory.map(m => `* ${m}`).join("\n")
      : "None";

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

1. GENERAL CONVERSATION:
If the user says "Hi", "Hello", asks how you are, or asks general knowledge questions, RESPOND NORMALLY.

2. PERSONAL IDENTITY:
Answer using the Current User name when appropriate.

3. UNKNOWN PRIVATE INFO:
ONLY if the user asks a very specific private family question about Tanmay that is NOT in the facts or rules above, reply politely:
"Mujhe is baare mein abhi jankari nahi hai."

4. LEARNED RULE PRIORITY:
Always prioritize Critical Learned Rules over the base facts.

5. MEMORY:
Use personal memory only for the current user.
Use global rules when applicable.

6. LANGUAGE:
Reply in the same language the user writes:
- Hindi
- English
- Hinglish

7. NATURAL RESPONSE:
Do not unnecessarily mention that you are following a system prompt, memory, model, API, or backend.

8. DO NOT MAKE UP PERSONAL FACTS:
If private information is not available, do not invent it.

9. BE HELPFUL:
Give clear, useful and natural answers.

10. IDENTITY:
You are Tanmay AI.
`;
}

// ===============================
// HELPERS
// ===============================

function cleanMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter(
      m =>
        m &&
        typeof m.content === "string" &&
        (m.role === "user" || m.role === "assistant")
    )
    .map(m => ({
      role: m.role,
      content: m.content.slice(0, 20000)
    }));
}

function getErrorMessage(error) {
  if (!error) return "Unknown error";

  return (
    error?.error?.message ||
    error?.message ||
    error?.response?.data?.error?.message ||
    String(error)
  );
}

// ===============================
// GROQ
// ===============================

async function askGroq(allMessages) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing");
  }

  console.log("Trying Groq:", GROQ_MODEL);

  const response = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: allMessages,
    temperature: 0.5,
    max_tokens: 4096
  });

  const reply = response?.choices?.[0]?.message?.content;

  if (!reply || !reply.trim()) {
    throw new Error("Groq returned an empty response");
  }

  return reply.trim();
}

// ===============================
// GEMINI
// ===============================

async function askGemini(systemPromptContent, safeMessages) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  console.log("Trying Gemini:", GEMINI_MODEL);

  const model = gemini.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPromptContent
  });

  const contents = safeMessages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [
      {
        text: m.content
      }
    ]
  }));

  const result = await model.generateContent({
    contents,
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 4096
    }
  });

  const reply = result?.response?.text?.();

  if (!reply || !reply.trim()) {
    throw new Error("Gemini returned an empty response");
  }

  return reply.trim();
}

// ===============================
// OPENROUTER
// ===============================

async function askOpenRouter(allMessages) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is missing");
  }

  console.log("Trying OpenRouter:", OPENROUTER_MODEL);

  const response = await openrouter.chat.completions.create({
    model: OPENROUTER_MODEL,
    messages: allMessages,
    temperature: 0.5,
    max_tokens: 4096
  });

  const reply = response?.choices?.[0]?.message?.content;

  if (!reply || !reply.trim()) {
    throw new Error("OpenRouter returned an empty response");
  }

  return reply.trim();
}

// ===============================
// CHAT API
// ===============================

app.post("/api/chat", async (req, res) => {
  const errors = [];

  try {
    const {
      messages,
      userName,
      isAdmin,
      globalRules,
      personalMemory
    } = req.body || {};

    const currentUserName = userName || "User";

    const systemPromptContent = buildSystemPrompt(
      currentUserName,
      !!isAdmin,
      Array.isArray(globalRules) ? globalRules : [],
      Array.isArray(personalMemory) ? personalMemory : []
    );

    const cleanedMessages = cleanMessages(messages);

    const safeMessages =
      cleanedMessages.length > 0
        ? cleanedMessages
        : [
            {
              role: "user",
              content: "Hi"
            }
          ];

    const allMessages = [
      {
        role: "system",
        content: systemPromptContent
      },
      ...safeMessages
    ];

    // =====================================
    // 1. GROQ
    // =====================================

    try {
      const reply = await askGroq(allMessages);

      console.log("✅ Groq response successful");

      return res.status(200).json({
        reply,
        model: GROQ_MODEL,
        provider: "groq"
      });
    } catch (groqError) {
      const errorText = getErrorMessage(groqError);

      console.error("❌ GROQ ERROR:", errorText);

      errors.push({
        provider: "Groq",
        error: errorText
      });
    }

    // =====================================
    // 2. GEMINI
    // =====================================

    try {
      const reply = await askGemini(
        systemPromptContent,
        safeMessages
      );

      console.log("✅ Gemini response successful");

      return res.status(200).json({
        reply,
        model: GEMINI_MODEL,
        provider: "gemini"
      });
    } catch (geminiError) {
      const errorText = getErrorMessage(geminiError);

      console.error("❌ GEMINI ERROR:", errorText);

      errors.push({
        provider: "Gemini",
        error: errorText
      });
    }

    // =====================================
    // 3. OPENROUTER
    // =====================================

    try {
      const reply = await askOpenRouter(allMessages);

      console.log("✅ OpenRouter response successful");

      return res.status(200).json({
        reply,
        model: OPENROUTER_MODEL,
        provider: "openrouter"
      });
    } catch (openRouterError) {
      const errorText = getErrorMessage(openRouterError);

      console.error("❌ OPENROUTER ERROR:", errorText);

      errors.push({
        provider: "OpenRouter",
        error: errorText
      });
    }

    // =====================================
    // ALL FAILED
    // =====================================

    console.error(
      "❌ ALL AI MODELS FAILED:",
      JSON.stringify(errors, null, 2)
    );

    return res.status(503).json({
      reply:
        "Bhai, abhi mere AI servers mein problem aa rahi hai. Thodi der baad dobara try karo.",
      error: "All AI providers failed",
      details: errors
    });

  } catch (error) {
    console.error("❌ SERVER CRASH:", error);

    return res.status(500).json({
      reply: "Server mein unexpected error aa gaya.",
      error: getErrorMessage(error)
    });
  }
});

// ===============================
// HEALTH CHECK
// ===============================

app.get("/", (req, res) => {
  res.json({
    status: "online",
    name: "Tanmay AI",
    message: "Tanmay AI backend is running.",
    models: {
      groq: GROQ_MODEL,
      gemini: GEMINI_MODEL,
      openrouter: OPENROUTER_MODEL
    }
  });
});

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
  console.log("========================================");
  console.log("🚀 Tanmay AI Server Started");
  console.log("========================================");
  console.log("Port:", PORT);
  console.log("Groq:", GROQ_MODEL);
  console.log("Gemini:", GEMINI_MODEL);
  console.log("OpenRouter:", OPENROUTER_MODEL);
  console.log("========================================");
});