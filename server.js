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

// ================== STRICT SYSTEM PROMPT FOR ALL 3 AIs ==================
const SYSTEM_CONTENT = `You are Tanmay AI, a smart and premium AI assistant created by Tanmay Sahu.

STRICT RULES:
1. Always reply in the same language used by the user (Hindi, English, Hinglish, or Urdu). Keep replies short and natural.
2. NEVER mention "zyra_vlogs" or "Zyra". If asked about YouTube, your channel is "Tanmay 3.0".
3. If user asks who created you, reply strictly:
"Main Tanmay AI hun, mujhe Tanmay Sahu ne banaya hai. Kya aap unke baare mein aur jaan na chahte hain?"

4. If the user asks "Who is Tanmay Sahu?" or wants to know about him, give ONLY 1 or 2 lines at a time and ask the question after each chunk:

Chunk 1:
Tanmay Sahu is a software/web developer from Chhindwara, Madhya Pradesh.
Question: "Kya aap unke baare mein aur jaan na chahenge?"

Chunk 2:
Currently he is a Class 12th student (MP Board, English Medium).
Question: "Kya aap aur jaana chahenge?"

Chunk 3:
He also manages his family business, Sahu Hotel, and a grocery shop.
Question: "Kya aap aur jaana chahenge?"

Chunk 4:
Tanmay Sahu social media par bhi active hain.
Instagram: @tanmay.sahu.45
YouTube: @Tanmay3.0
Question: "Kya aap aur jaana chahenge?"

Chunk 5:
He is a huge cricket fan, supports RCB and Virat Kohli.
Question: "Kya aap unke baare mein aur kuchh jaana chahenge?"

5. Never self-interpret or guess anything outside these facts. Keep replies short and friendly.`;

// ================== CHAT API ENDPOINT ==================
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    // Groq aur OpenRouter ke liye system message taiyar karna
    const systemMessage = { role: "system", content: SYSTEM_CONTENT };
    const allMessages = [systemMessage, ...messages];

    // ----------------- 1. GROQ (FIRST ATTEMPT) -----------------
    try {
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: allMessages,
        temperature: 0.4
      });

      const reply = response.choices[0]?.message?.content || "";
      console.log("👉 Response delivered by Groq");
      return res.json({ reply });

    } catch (err) {
      console.log("❌ Groq failed, switching to Gemini...");
    }

    // ----------------- 2. GEMINI (SECOND ATTEMPT) -----------------
    try {
      const model = gemini.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: SYSTEM_CONTENT // Isse Gemini strictly wahi bolega jo likha hai
      });

      // Gemini ke format ke hisab se roles convert karna (assistant -> model)
      const contents = messages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));

      const result = await model.generateContent({ contents });
      const reply = result.response.text();

      console.log("👉 Response delivered by Gemini");
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
      console.log("👉 Response delivered by OpenRouter");
      return res.json({ reply });

    } catch (err) {
      console.error("❌ OpenRouter Error:", err);
    }

    // Agar teeno fail ho jayein
    return res.status(500).json({
      error: "Sabhi AI services abhi unavailable hain."
    });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

// ================== START SERVER ==================
app.listen(PORT, () => {
  console.log(`🚀 Tanmay AI Hybrid Server running on port ${PORT}`);
});