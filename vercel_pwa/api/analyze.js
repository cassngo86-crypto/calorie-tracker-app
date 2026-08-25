import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  // CORS Headers
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
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on Vercel environment variables.' });
    }

    const { image } = req.body || {};
    if (!image) {
      return res.status(400).json({ error: 'No image data provided.' });
    }

    // Initialize Gemini Client
    const ai = new GoogleGenAI({ apiKey });

    // Clean base64 string
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Analyze this food image. Return ONLY a raw JSON object with no markdown formatting:
    {
      "food_name": "Name of food",
      "calories": 400,
      "protein_g": 25,
      "carbs_g": 40,
      "fat_g": 15
    }`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data,
          },
        },
      ],
    });

    const text = response.text || '';
    // Strip markdown wrappers if present
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanJson);

    return res.status(200).json(parsedData);
  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to process image analysis', 
      details: error.message || String(error) 
    });
  }
}