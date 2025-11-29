

import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceName, Character, ScriptLine } from "../types";

const API_KEY = process.env.API_KEY || '';

// Singleton instance helper
let genAIInstance: GoogleGenAI | null = null;

const getGenAI = () => {
  if (!genAIInstance) {
    genAIInstance = new GoogleGenAI({ apiKey: API_KEY });
  }
  return genAIInstance;
};

interface SingleVoiceParams {
  text: string;
  voice: VoiceName;
}

interface DialogueParams {
  script: ScriptLine[];
  characters: Character[];
}

interface CloningParams {
  text: string;
  referenceAudio: string; // Base64 string of the audio file
  mimeType: string;
}

export async function generateSingleVoice(params: SingleVoiceParams): Promise<string> {
  const ai = getGenAI();
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: params.text }] }],
      config: {
        responseModalities: [Modality.AUDIO], 
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: params.voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data returned from Gemini API");
    }
    return base64Audio;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
}

export async function generateDialogue(params: DialogueParams): Promise<string> {
  const ai = getGenAI();
  
  // Construct the multi-speaker prompt
  const promptText = params.script
    .map((line) => {
      const char = params.characters.find(c => c.id === line.characterId);
      return `${char ? char.name : 'Unknown'}: ${line.text}`;
    })
    .join('\n');

  // Configure speakers
  const speakerVoiceConfigs = params.characters.map(char => ({
    speaker: char.name,
    voiceConfig: {
      prebuiltVoiceConfig: { voiceName: char.voice }
    }
  }));

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: promptText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: speakerVoiceConfigs
          }
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data returned from Gemini API");
    }
    return base64Audio;
  } catch (error) {
    console.error("Gemini TTS Dialogue Error:", error);
    throw error;
  }
}

export async function generateClonedSpeech(params: CloningParams): Promise<string> {
  const ai = getGenAI();

  try {
    // Attempt 1: Try Gemini 2.0 Flash (Native Audio)
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: params.mimeType,
              data: params.referenceAudio
            }
          },
          {
            text: `Please speak the following text. Try to mimic the voice, tone, and speaking style of the speaker in the provided audio file as closely as possible.\n\nText: "${params.text}"`
          }
        ]
      }],
      config: {
        // Use string 'AUDIO' to avoid "unsupported response modality: 4" error on the experimental model
        responseModalities: ['AUDIO' as any],
      }
    });

    let base64Audio = '';
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          base64Audio = part.inlineData.data;
          break;
        }
      }
    }

    if (!base64Audio) {
       throw new Error("Model returned no audio data.");
    }

    return base64Audio;

  } catch (error: any) {
    console.warn("Native Cloning failed (likely due to access restrictions), falling back to Standard TTS.", error);
    
    // Fallback: Use Standard TTS with a high-quality default voice.
    try {
        return await generateSingleVoice({ 
            text: params.text, 
            voice: VoiceName.Aoede 
        });
    } catch (fallbackError: any) {
        // Throw the fallback error so we know why the backup failed
        throw new Error(`Voice Generation failed. Native error: ${error.message}. Fallback error: ${fallbackError.message}`);
    }
  }
}

export async function transcribeAudio(base64Audio: string, mimeType: string): Promise<string> {
  const ai = getGenAI();
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: base64Audio } },
            { text: "Transcribe the speech in this audio file into text. Return only the transcription, no other text." }
          ]
        }
      ]
    });

    if (!response.text) {
        throw new Error("No transcription generated.");
    }

    return response.text;
  } catch (error: any) {
    console.error("Gemini Transcription Error:", error);
    throw error;
  }
}