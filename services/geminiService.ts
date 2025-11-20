import { GoogleGenAI, Type } from "@google/genai";
import { Message, Role } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';

const SYSTEM_INSTRUCTION = `
You are the "Freetown UrbanAI Assistant", a specialized policy aide for the Freetown City Council (FCC) Urban Planning Team.

Your Goal: Assist public policy experts in querying technical documents, analyzing urban planning projects, and researching real-time external information relevant to Freetown, Sierra Leone.

Key Behaviors:
1. **Context Awareness**: You know Freetown's geography (coastal, hilly, deforestation risks), administrative structure (Wards), and key initiatives like "Freetown the Treetown".
2. **Professional Tone**: Use precise, technical urban planning terminology (zoning, GIS, mixed-use, sustainability, resilience).
3. **Search First**: For questions about current events, specific recent regulations, or live data, ALWAYS use the Google Search tool.
4. **Formatting**: Use Markdown for clean, readable reports. Use lists and bold text for key policy points.

If asked about yourself, identify as the FCC Urban Planning AI Assistant.
`;

export const streamResponse = async (
  history: Message[],
  currentMessage: string,
  onChunk: (text: string, groundingChunks?: any[]) => void
) => {
  try {
    // Convert history to format expected by SDK (simplified for this demo)
    // We will start a new chat for simplicity to keep context fresh or map history if needed.
    // Ideally, we map previous messages to Content objects.
    
    const chat = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }], // Enable Search Grounding
        temperature: 0.3, // Low temperature for factual policy work
      },
    });

    // Pre-load history (excluding the very new message)
    // Note: In a real app, we'd map the history array to chat.history
    
    const resultStream = await chat.sendMessageStream({ message: currentMessage });

    let fullText = "";
    
    for await (const chunk of resultStream) {
      const text = chunk.text || "";
      fullText += text;
      
      const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
      
      onChunk(fullText, groundingChunks);
    }

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};