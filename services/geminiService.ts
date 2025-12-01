import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Transcribes audio using Gemini 2.5 Flash model.
 * @param audioBase64 The base64 encoded audio string.
 * @param mimeType The mime type of the audio.
 * @returns The transcribed text in LRC format.
 */
export const transcribeAudio = async (audioBase64, mimeType) => {
  try {
    const model = 'gemini-2.5-flash';
    // Instructions focused on LRC format generation
    const prompt = `
      Listen to the provided audio file and generate synchronized lyrics in standard LRC format.
      
      STRICT RULES:
      1. Format must be strictly: [MM:SS.xx] Lyric text
      2. Synchronize every line of the song.
      3. Do NOT wrap the output in markdown code blocks (like \`\`\`lrc). Output RAW text only.
      4. Do NOT include any intro, outro, or conversational text.
      5. Timestamps must be chronological.
      6. If there are long instrumental breaks, you may insert a line like [MM:SS.xx] (Instrumental).
      7. Detect the language automatically.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: audioBase64
            }
          },
          {
            text: prompt
          }
        ]
      }
    });

    return response.text?.trim() || "[00:00.00] No lyrics generated.";
  } catch (error) {
    console.error("Gemini Transcription Error:", error);
    throw new Error("Failed to transcribe audio. Please try again.");
  }
};