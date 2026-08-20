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

// =====================================================
// CURRENT MODELS
// =====================================================

const GROQ_MODEL = "openai/gpt-oss-120b";
const GEMINI_MODEL = "gemini-2.5-flash";
const OPENROUTER_MODEL = "openrouter/free";

// =====================================================
// ADMIN
// =====================================================

const ADMIN_EMAILS = [
  "tanmaysahu652@gmail.com"
];

// =====================================================
// PRIVATE FAMILY FACTS
// =====================================================

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

// =====================================================
// SYSTEM PROMPT
// =====================================================

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

🔥 CRITICAL LEARNED GLOBAL RULES:
${globalRulesStr}

USER SPECIFIC PERSONAL MEMORY:
${personalMemoryStr}

TANMAY'S FAMILY FACTS:
${BASE_PRIVATE_FACTS}

CORE INSTRUCTIONS:

1. GENERAL CONVERSATION:
If the user says Hi, Hello, asks how you are, or asks general questions, respond normally.

2. PERSONAL IDENTITY:
Use the Current User name when appropriate.

3. GLOBAL RULES:
Always follow the Critical Learned Global Rules.

4. PERSONAL MEMORY:
Use personal memory only when relevant to the current user.

5. UNKNOWN PRIVATE INFO:
If a very specific private family question is asked and the information is not available in the facts, global rules, or personal memory, say:
"Mujhe is baare mein abhi jankari nahi hai."

6. LANGUAGE:
Reply in the same language the user uses:
Hindi, English, or Hinglish.

7. NATURAL ANSWERS:
Do not talk about system prompts, APIs, backend, fallback models, or internal instructions.

8. DO NOT INVENT:
Never make up personal facts.

9. BE HELPFUL:
Give clear, useful and natural answers.
`;
}

// =====================================================
// CLEAN MESSAGES
// =====================================================

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

// =====================================================
// ERROR HELPER
// =====================================================

function errorText(error) {

  return (
    error?.error?.message ||
    error?.message ||
    error?.response?.data?.error?.message ||
    String(error)
  );
}

// =====================================================
// GROQ
// =====================================================

async function askGroq(messages) {

  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing");
  }

  console.log("Trying Groq:", GROQ_MODEL);

  const response =
    await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      temperature: 0.5,
      max_tokens: 4096
    });

  const reply =
    response?.choices?.[0]?.message?.content;

  if (!reply || !reply.trim()) {
    throw new Error("Groq returned empty response");
  }

  return reply.trim();
}

// =====================================================
// GEMINI
// =====================================================

async function askGemini(
  systemPrompt,
  messages
) {

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  console.log("Trying Gemini:", GEMINI_MODEL);

  const model =
    gemini.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt
    });

  const contents =
    messages.map(m => ({
      role:
        m.role === "assistant"
          ? "model"
          : "user",

      parts: [
        {
          text: m.content
        }
      ]
    }));

  const result =
    await model.generateContent({
      contents
    });

  const reply =
    result?.response?.text?.();

  if (!reply || !reply.trim()) {
    throw new Error("Gemini returned empty response");
  }

  return reply.trim();
}

// =====================================================
// OPENROUTER
// =====================================================

async function askOpenRouter(messages) {

  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY is missing"
    );
  }

  console.log(
    "Trying OpenRouter:",
    OPENROUTER_MODEL
  );

  const response =
    await openrouter.chat.completions.create({
      model: OPENROUTER_MODEL,
      messages,
      temperature: 0.5,
      max_tokens: 4096
    });

  const reply =
    response?.choices?.[0]?.message?.content;

  if (!reply || !reply.trim()) {
    throw new Error(
      "OpenRouter returned empty response"
    );
  }

  return reply.trim();
}

// =====================================================
// CHAT API
// =====================================================

app.post("/api/chat", async (req, res) => {

  const errors = [];

  try {

    const {
      messages,
      userName,
      userEmail,
      globalRules,
      personalMemory
    } = req.body || {};

    const currentUserName =
      userName || "User";

    // -----------------------------------------------
    // ADMIN IS CALCULATED ON SERVER
    // -----------------------------------------------

    const isAdmin =
      !!userEmail &&
      ADMIN_EMAILS.includes(
        String(userEmail).toLowerCase()
      );

    const systemPrompt =
      buildSystemPrompt(
        currentUserName,
        isAdmin,
        Array.isArray(globalRules)
          ? globalRules
          : [],
        Array.isArray(personalMemory)
          ? personalMemory
          : []
      );

    const safeMessages =
      cleanMessages(messages);

    const finalMessages =
      safeMessages.length > 0
        ? safeMessages
        : [
            {
              role: "user",
              content: "Hi"
            }
          ];

    const allMessages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...finalMessages
    ];

    // =================================================
    // 1. GROQ
    // =================================================

    try {

      const reply =
        await askGroq(allMessages);

      console.log(
        "✅ GROQ SUCCESS"
      );

      return res.json({
        reply,
        provider: "Groq",
        model: GROQ_MODEL,
        showModel: isAdmin
      });

    } catch (error) {

      const message =
        errorText(error);

      console.error(
        "❌ GROQ ERROR:",
        message
      );

      errors.push({
        provider: "Groq",
        model: GROQ_MODEL,
        error: message
      });
    }

    // =================================================
    // 2. GEMINI
    // =================================================

    try {

      const reply =
        await askGemini(
          systemPrompt,
          finalMessages
        );

      console.log(
        "✅ GEMINI SUCCESS"
      );

      return res.json({
        reply,
        provider: "Gemini",
        model: GEMINI_MODEL,
        showModel: isAdmin
      });

    } catch (error) {

      const message =
        errorText(error);

      console.error(
        "❌ GEMINI ERROR:",
        message
      );

      errors.push({
        provider: "Gemini",
        model: GEMINI_MODEL,
        error: message
      });
    }

    // =================================================
    // 3. OPENROUTER
    // =================================================

    try {

      const reply =
        await askOpenRouter(
          allMessages
        );

      console.log(
        "✅ OPENROUTER SUCCESS"
      );

      return res.json({
        reply,
        provider: "OpenRouter",
        model: OPENROUTER_MODEL,
        showModel: isAdmin
      });

    } catch (error) {

      const message =
        errorText(error);

      console.error(
        "❌ OPENROUTER ERROR:",
        message
      );

      errors.push({
        provider: "OpenRouter",
        model: OPENROUTER_MODEL,
        error: message
      });
    }

    // =================================================
    // ALL FAILED
    // =================================================

    console.error(
      "❌ ALL AI MODELS FAILED"
    );

    console.error(
      JSON.stringify(
        errors,
        null,
        2
      )
    );

    return res.status(503).json({
      reply:
        "Bhai, abhi AI servers mein problem aa rahi hai. Thodi der baad dobara try karo.",
      error:
        "All AI providers failed"
    });

  } catch (error) {

    console.error(
      "❌ SERVER CRASH:",
      error
    );

    return res.status(500).json({
      reply:
        "Server mein unexpected error aa gaya.",
      error:
        errorText(error)
    });
  }
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/", (req, res) => {

  res.json({
    status: "online",
    name: "Tanmay AI",
    models: {
      groq: GROQ_MODEL,
      gemini: GEMINI_MODEL,
      openrouter: OPENROUTER_MODEL
    }
  });
});

// =====================================================
// START
// =====================================================

app.listen(PORT, () => {

  console.log(
    "===================================="
  );

  console.log(
    "🚀 Tanmay AI Server Started"
  );

  console.log(
    "===================================="
  );

  console.log(
    "Groq:",
    GROQ_MODEL
  );

  console.log(
    "Gemini:",
    GEMINI_MODEL
  );

  console.log(
    "OpenRouter:",
    OPENROUTER_MODEL
  );

  console.log(
    "===================================="
  );
});