import { GoogleGenAI, Type } from "@google/genai";
import { AIRecommendation } from "../types";

// Using environment variable as per instructions
const apiKey = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey });

export const generateBucketListSuggestions = async (
  lat: number,
  lng: number
): Promise<AIRecommendation[]> => {
  if (!apiKey) {
    console.warn("No API KEY provided for Gemini");
    return [];
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Suggest 5 unique, hidden-gem bucket list activities within 50km of latitude ${lat}, longitude ${lng}. 
      For each item, suggest a 'bucket' (e.g. Food, Parks, Cities, Adventure, Culture) and an 'interest' level (e.g. Must try, ASAP, Before die, Chill).
      Be specific about the location.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              category: { 
                type: Type.STRING,
                description: "The bucket category, e.g. Food, Parks, Cities"
              },
              interest: {
                type: Type.STRING,
                description: "Interest level, e.g. Must try, ASAP, Before die"
              },
              approxLat: { type: Type.NUMBER },
              approxLng: { type: Type.NUMBER }
            },
            required: ["title", "description", "category", "interest", "approxLat", "approxLng"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    return JSON.parse(text) as AIRecommendation[];

  } catch (error) {
    console.error("Error generating suggestions:", error);
    return [];
  }
};