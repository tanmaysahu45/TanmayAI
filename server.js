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

// ================== APIs ==================
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

// ================== SYSTEM PROMPT ==================
const SYSTEM_CONTENT = `You are Tanmay AI, a smart and premium AI assistant created by Tanmay Sahu.

STRICT RULES:

1. Always reply in the same language used by the user. If the user writes in Hindi, reply in Hindi. If the user writes in English, reply in English. If the user writes in Hinglish, reply in Hinglish. If the user writes in Urdu, reply in Urdu. Keep replies short and natural.
2. Never mention zyra_vlogs or Zyra.
3. If user asks who created you, reply:
Main Tanmay AI hun, mujhe Tanmay Sahu ne banaya hai. Kya aap unke baare mein aur jaan na chahte hain?

4. If the user asks "Who is Tanmay Sahu?" or asks to know more about him:

- Never reveal everything at once.
- Give only 1 or 2 short lines at a time.
- After every chunk, ask politely if the user wants to know more.
- Continue only if the user says yes or asks again.
- Keep continuing the conversation naturally.

Chunk 1:
Tanmay Sahu is a software/web developer from Chhindwara, Madhya Pradesh.

Then ask:
"Kya aap unke baare mein aur jaan na chahenge?"

Chunk 2:
Currently he is a Class 12th student (MP Board, English Medium).

Again ask:
"Kya aap aur jaana chahenge?"

Chunk 3:
He also manages his family business, Sahu Hotel, and a grocery shop.

Again ask:
"Kya aap aur jaana chahenge?"

Chunk 4:
Tanmay Sahu social media par bhi active hain.

Instagram:
@tanmay.sahu.45

YouTube:
@Tanmay3.0

Chunk 5:
He is a huge cricket fan, supports RCB and Virat Kohli.

Then ask:
"Kya aap unke baare mein aur kuchh jaana chahenge?"


5. Keep replies short and friendly.`;

// ================== CHAT ==================
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    const systemMessage = {
      role: "system",
      content: SYSTEM_CONTENT
    };

    const allMessages = [systemMessage, ...messages];

    // ========= 1. GROQ =========
    try {
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: allMessages,
        temperature: 0.4
      });

      const reply =
        response.choices[0]?.message?.content || "";

      console.log("Response from Groq");

      return res.json({
        reply
      });

    } catch (err) {
      console.log("Groq failed, switching to Gemini...");
    }

    // ========= 2. GEMINI =========
    try {
      const model = gemini.getGenerativeModel({
        model: "gemini-2.5-flash"
      });

      const prompt = allMessages
        .map(m => `${m.role}: ${m.content}`)
        .join("\n");

      const result = await model.generateContent(prompt);

      const reply = result.response.text();

      console.log("Response from Gemini");

      return res.json({
        reply
      });

    } catch (err) {
      console.log("Gemini failed, switching to OpenRouter...");
    }

    // ========= 3. OPENROUTER =========
    try {
      const response = await openrouter.chat.completions.create({
        model: "poolside/laguna-m.1:free",
        messages: allMessages
      });

      const reply =
        response.choices[0]?.message?.content || "";

      console.log("Response from OpenRouter");

      return res.json({
        reply
      });

    } catch (err) {
  console.error("OpenRouter Error:");
  console.error(err);
}

    return res.status(500).json({
      error: "Sabhi AI services abhi unavailable hain."
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Server Error"
    });
  }
});

// ================== START ==================
app.listen(PORT, () => {
  console.log(`Tanmay AI Hybrid Server running on port ${PORT}`);
});