import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // Setup CORS agar bisa diakses dari frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // PENTING: Gunakan variable 'GEMINI_API_KEY' (tanpa VITE_)
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Server Misconfiguration: API Key missing' });
  }

  try {
    const { issue } = req.body;
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      Peran: Kepala Mekanik Bengkel. Analisa keluhan: "${issue}".
      Tugas: 
      1. Validasi: Apakah ini masalah teknis motor? (Isi chat, sapaan 'p', makanan, curhat -> TOLAK/FALSE).
      2. Output:
         - Jika VALID: Berikan diagnosis teknis singkat.
         - Jika TIDAK VALID: Berikan alasan.
      
      Format JSON Wajib: 
      {"valid": boolean, "summary": "string", "mins": number}
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const data = JSON.parse(responseText);

    return res.status(200).json(data);

  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}