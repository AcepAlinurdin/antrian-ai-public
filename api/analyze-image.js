import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // CORS Setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API Key missing' });

  try {
    const { imageBase64, mimeType } = req.body; // Menerima gambar format Base64

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash", // Model ini support Gambar + Teks
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      Peran: Asisten Gudang Bengkel Pintar.
      Tugas: Ekstrak informasi dari gambar faktur, struk belanja, atau label kemasan barang ini.
      
      Tujuan: Mengisi data inventory otomatis.
      
      Instruksi:
      1. Cari Nama Barang (jika banyak, ambil yang paling dominan atau list pertama).
      2. Cari Harga (jika ada harga satuan, ambil itu).
      3. Cari Kuantitas/Stok (jika tidak ada, set default 1).
      4. Cari Nama Supplier/Toko (jika ada).
      5. Tentukan Kategori barang berdasarkan namanya (Oli/Ban/Sparepart/Service).

      Format JSON Wajib:
      {
        "nama_barang": "string",
        "kategori": "string",
        "harga_beli": number,
        "harga_jual_estimasi": number, (biasanya harga beli + 20%)
        "stok": number,
        "supplier": "string"
      }
    `;

    // Mengirim gambar ke Gemini (Format Inline Data)
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType || "image/jpeg",
        },
      },
    ]);

    const responseText = result.response.text();
    const data = JSON.parse(responseText);

    return res.status(200).json(data);

  } catch (error) {
    console.error('Gemini Vision Error:', error);
    return res.status(500).json({ error: 'Gagal memproses gambar.' });
  }
}