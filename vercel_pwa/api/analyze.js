import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64 } = req.body;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageBase64
          }
        },
        'Analyze meal nutrition using standard USDA nutrient database weights.'
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mealName: { type: Type.STRING },
            calories: { type: Type.INTEGER },
            protein: { type: Type.INTEGER },
            carbs: { type: Type.INTEGER },
            fat: { type: Type.INTEGER },
            healthBenefits: { type: Type.ARRAY, items: { type: Type.STRING } },
            cautions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['mealName', 'calories', 'protein', 'carbs', 'fat']
        }
      }
    });

    res.status(200).json(JSON.parse(response.text));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}