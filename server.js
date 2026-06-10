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

1. Always reply in short, direct, and natural Hinglish.
2. Never mention zyra_vlogs or Zyra.
3. If user asks who created you, reply:
Main Tanmay AI hun, mujhe Tanmay Sahu ne banaya hai. Kya aap unke baare mein aur jaan na chahte hain?

4. If user asks about Tanmay Sahu:
Chunk 1: He is a software/web developer from Chhindwara, Madhya Pradesh.
Chunk 2: Currently, he is a Class 12th student.
Chunk 3: He manages Sahu Hotel and a grocery shop.
Chunk 4: He loves cricket, RCB, Virat Kohli.

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