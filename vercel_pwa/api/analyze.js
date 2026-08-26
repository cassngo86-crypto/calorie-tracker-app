import { GoogleGenAI } from '@google/genai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

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

  // 1. Inspect incoming payload in Vercel Logs
  console.log('Incoming headers:', req.headers);
  console.log('Body type:', typeof req.body);

  let body = req.body;

  // Handle payload stringification safely
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (parseErr) {
      console.error('Failed to parse JSON body string:', parseErr.message);
      return res.status(400).json({ error: 'Invalid JSON string in request body' });
    }
  }

  const { image } = body || {};

  if (!image) {
    console.error('Validation failed: No image field in request body.', body ? Object.keys(body) : 'Body is null');
    return res.status(400).json({ error: 'Missing "image" property in request payload.' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is missing on Vercel.' });
    }

    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        { inlineData: { mimeType, data: base64Data } },
        {
          text: `Analyze this food image. Return STRICTLY raw JSON with:
          {
            "food_name": "String",
            "calories": 400,
            "protein_g": 25,
            "carbs_g": 40,
            "fat_g": 15
          }`,
        },
      ],
    });

    const rawText = response.text || '';
    const cleanJson = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanJson);

    return res.status(200).json({
      food_name: parsedData.food_name || 'Scanned Meal',
      calories: Number(parsedData.calories) || 0,
      protein_g: Number(parsedData.protein_g) || 0,
      carbs_g: Number(parsedData.carbs_g) || 0,
      fat_g: Number(parsedData.fat_g) || 0,
    });
  } catch (error) {
    console.error('Gemini execution error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}