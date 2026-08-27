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

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY environment variable missing.' });
    }

    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);

    const image = body?.image || body?.imageBase64;
    const mealLabel = body?.mealLabel || 'Meal';

    if (!image) {
      return res.status(400).json({ error: 'Missing image in payload.' });
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
          text: `Analyze this food image. Context label provided by user: "${mealLabel}".
          Return STRICTLY raw valid JSON with no code block markdown fences using this exact layout:
          {
            "food_name": "String",
            "calories": 450,
            "protein_g": 20,
            "carbs_g": 60,
            "fat_g": 15,
            "ingredients": [
              { "name": "Steamed Bun (Baozi)", "weight_g": 110, "protein_g": 9, "carbs_g": 36, "fat_g": 7 }
            ],
            "health_benefits": [
              "High quality protein from the hard-boiled egg aids muscle maintenance and satiety."
            ],
            "cautions": [
              "Steamed buns made with refined white flour can cause a rapid spike in blood sugar."
            ],
            "healthier_swaps": [
              "Replace white flour bun with whole wheat or sweet potato for complex fiber."
            ]
          }`,
        },
      ],
    });

    const rawText = response.text || '';
    const cleanJson = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanJson);

    return res.status(200).json(parsedData);
  } catch (error) {
    console.error('API Handler Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}