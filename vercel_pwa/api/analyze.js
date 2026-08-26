import { GoogleGenAI } from '@google/genai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

// Exponential backoff helper for temporary spikes (503)
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
        return res.status(400).json({ error: 'Invalid JSON body payload.' });
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

    // Request content generation using gemini-3.6-flash
    const response = await generateContentWithRetry(
      ai,
      {
        model: 'gemini-3.6-flash',
        contents: [
          { inlineData: { mimeType, data: base64Data } },
          {
            text: `Analyze this food image. Return STRICTLY raw valid JSON with no markdown block fences or conversational text using exact format:
            {
              "food_name": "String",
              "calories": 400,
              "protein_g": 25,
              "carbs_g": 40,
              "fat_g": 15
            }`,
          },
        ],
      },
      3,
      1000
    );

    const rawText = response.text || '';
    
    // Clean code blocks and sanitize string output cleanly
    const jsonString = rawText
      .replace(/```(?:json)?/gi, '')
      .replace(/```/g, '')
      .trim();

    const parsedData = JSON.parse(jsonString);

    return res.status(200).json({
      food_name: parsedData.food_name || 'Scanned Meal',
      calories: Number(parsedData.calories) || 0,
      protein_g: Number(parsedData.protein_g) || 0,
      carbs_g: Number(parsedData.carbs_g) || 0,
      fat_g: Number(parsedData.fat_g) || 0,
    });
  } catch (error) {
    console.error('Server execution error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}