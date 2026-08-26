import { GoogleGenAI } from '@google/genai';


export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};
// Helper function for exponential backoff retries
async function generateContentWithRetry(ai, params, retries = 3, delay = 1000) {
  try {
    return await ai.models.generateContent(params);
  } catch (error) {
    const is503 = error?.status === 503 || error?.message?.includes('503') || error?.message?.includes('high demand');
    if (retries > 0 && is503) {
      console.warn(`Gemini API 503 high demand spike. Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return generateContentWithRetry(ai, params, retries - 1, delay * 2);
    }
    throw error;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is missing on Vercel.' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }

    const { image } = body || {};
    if (!image) {
      return res.status(400).json({ error: 'No image data provided in request body.' });
    }

    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Analyze this food image. Return strictly raw JSON with no markdown formatting:
    {
      "food_name": "Name of food",
      "calories": 400,
      "protein_g": 25,
      "carbs_g": 40,
      "fat_g": 15
    }`;

    // Execute API request with automatic 3x retry on 503 capacity spikes
    const response = await generateContentWithRetry(
  ai,
  {
    model: 'gemini-3.6-flash',
    contents: [
      { inlineData: { mimeType, data: base64Data } },
      { text: "Analyze this food image and output the nutritional content." },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          food_name: { type: "STRING" },
          calories: { type: "NUMBER" },
          protein_g: { type: "NUMBER" },
          carbs_g: { type: "NUMBER" },
          fat_g: { type: "NUMBER" },
        },
        required: ["food_name", "calories", "protein_g", "carbs_g", "fat_g"],
      },
    },
  },
  3,
  1000
);

// When responseMimeType is application/json, response.text is guaranteed clean JSON string
const parsedData = JSON.parse(response.text);
return res.status(200).json(parsedData);
  } catch (error) {
    console.error('Server error:', error);
    
    // Friendly error messaging back to frontend
    const isBusy = error?.status === 503 || error?.message?.includes('high demand');
    return res.status(isBusy ? 503 : 500).json({ 
      error: isBusy 
        ? 'Gemini servers are experiencing temporary high demand. Please wait a moment and try scanning again.' 
        : error.message || 'Internal Server Error' 
    });
  }
}