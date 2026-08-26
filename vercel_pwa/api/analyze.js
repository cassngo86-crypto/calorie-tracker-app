import { GoogleGenAI } from '@google/genai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

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

    // Safely parse body if sent as raw string
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

    // Force structured JSON output using responseSchema
    const response = await generateContentWithRetry(
      ai,
      {
        model: 'gemini-3.6-flash',
        contents: [
          { inlineData: { mimeType, data: base64Data } },
          { text: 'Analyze this food photo. Estimate total calories and macro nutrients accurately.' },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              food_name: { type: 'STRING' },
              calories: { type: 'NUMBER' },
              protein_g: { type: 'NUMBER' },
              carbs_g: { type: 'NUMBER' },
              fat_g: { type: 'NUMBER' },
            },
            required: ['food_name', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
          },
        },
      },
      3,
      1000
    );

    const rawText = response.text || '{}';
    const parsedData = JSON.parse(rawText);

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