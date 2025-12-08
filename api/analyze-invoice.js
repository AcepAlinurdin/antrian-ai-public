// src/pages/InventoryPage.jsx
import React, { useState, useEffect } from 'react';
import { Loader2, Package, Sparkles, Save, ArrowLeft, Plus, Search } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import PageHeader from '../components/PageHeader';

export default function InventoryPage({ onNavigate }) {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [scannedItems, setScannedItems] = useState([]); // Menyimpan hasil scan nota

  useEffect(() => {
    if (supabase) {
      fetchInventory();
    }
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('nama_barang', { ascending: true });
      
      if (error) throw error;
      setInventory(data || []);
    } catch (error) {
      console.error("Error fetching inventory:", error.message);
      alert("Gagal mengambil data inventaris.");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    try {
      // Konversi file gambar ke base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64Data = reader.result.split(',')[1]; // Ambil data base64-nya saja

        // Panggil Backend API untuk analisis gambar
        const response = await fetch('/api/analyze-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64Data }),
        });

        if (!response.ok) throw new Error('Gagal menganalisis nota');

        const aiData = await response.json();

        if (aiData && aiData.items && aiData.items.length > 0) {
          // Siapkan data untuk ditampilkan di form konfirmasi
          const itemsToReview = aiData.items.map(item => ({
            ...item,
            kategori: '', // Kategori perlu diisi manual atau bisa ditambahkan logika AI lagi
            harga_jual: 0, // Harga jual perlu diisi manual
            supplier: aiData.supplier || '',
            isNew: true // Penanda ini barang baru dari scan
          }));
          setScannedItems(itemsToReview);
          alert(`✨ Gemini AI berhasil mendeteksi ${aiData.items.length} barang dari nota!`);
        } else {
          alert("⚠️ Gemini AI tidak dapat mendeteksi barang dari gambar tersebut.");
        }
      };
    } catch (error) {
      console.error("Error analyzing invoice:", error);
      alert("Terjadi kesalahan saat menganalisis nota.");
    } finally {
      setAnalyzing(false);
      e.target.value = null; // Reset input file
    }
  };

  const handleSaveScannedItems = async () => {
    setLoading(true);
    try {
      for (const item of scannedItems) {
        if (!item.nama_barang || item.qty <= 0) continue;

        // 1. CEK KEBERADAAN BARANG DI DATABASE
        const { data: existingItem, error: fetchError } = await supabase
          .from('inventory')
          .select('id, stok')
          .ilike('nama_barang', item.nama_barang) // Case-insensitive search
          .single(); // Ambil satu data saja

        if (fetchError && fetchError.code !== 'PGRST116') { // Error selain data tidak ditemukan
            console.error("Error checking item existence:", fetchError);
            throw fetchError;
        }

        if (existingItem) {
          // 2. UPDATE STOK JIKA BARANG SUDAH ADA
          const newStok = (existingItem.stok || 0) + parseInt(item.qty);
          const { error: updateError } = await supabase
            .from('inventory')
            .update({ stok: newStok, harga_beli: item.harga_beli_satuan, supplier: item.supplier }) // Update harga beli & supplier juga
            .eq('id', existingItem.id);

          if (updateError) throw updateError;
          console.log(`Updated stock for ${item.nama_barang}. New stock: ${newStok}`);

        } else {
          // 3. INSERT BARANG BARU JIKA BELUM ADA
          const { error: insertError } = await supabase
            .from('inventory')
            .insert([{
              nama_barang: item.nama_barang,
              kategori: item.kategori,
              stok: parseInt(item.qty),
              harga_beli: item.harga_beli_satuan,
              harga_jual: item.harga_jual,
              supplier: item.supplier
            }]);

          if (insertError) throw insertError;
          console.log(`Inserted new item: ${item.nama_barang}`);
        }
      }

      alert("✅ Semua data barang dari nota berhasil disimpan/diupdate!");
      setScannedItems([]); // Bersihkan list hasil scan
      fetchInventory(); // Refresh data tabel inventaris

    } catch (error) {
      console.error("Error saving scanned items:", error.message);
      alert("Gagal menyimpan data barang. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  // Fungsi untuk handle perubahan data di form konfirmasi scan
  const handleScannedItemChange = (index, field, value) => {
    const updatedItems = [...scannedItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setScannedItems(updatedItems);
  };


  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-mono">
      <PageHeader title="Manajemen Gudang" subtitle="Kelola stok barang dan input dari nota." icon={Package} 
        actions={<button onClick={() => onNavigate('admin')} className="px-4 py-2 text-slate-400 hover:text-white border border-slate-700 rounded-lg flex items-center gap-2 text-sm transition"><ArrowLeft size={16}/> Kembali ke Admin</button>} />
      
      <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-8">
        {/* Kolom Kiri: Upload Nota & Konfirmasi Data */}
        <div className="lg:col-span-1 space-y-6">
          {/* 1. Area Upload Nota */}
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Sparkles size={20} className="text-emerald-400"/> Scan Nota Otomatis</h3>
            <div className="mb-6">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-emerald-500/50 border-dashed rounded-lg cursor-pointer bg-slate-900/50 hover:bg-slate-900 transition relative overflow-hidden group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {analyzing ? <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-2" /> : <Sparkles className="w-8 h-8 text-emerald-500 mb-2 group-hover:scale-110 transition" />}
                        <p className="text-xs text-slate-400 text-center px-4">{analyzing ? "Gemini sedang menganalisis nota..." : "Upload Foto Nota (AI akan membaca)"}</p>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={analyzing} />
                </label>
            </div>
          </div>

          {/* 2. Form Konfirmasi Hasil Scan (Muncul jika ada hasil scan) */}
          {scannedItems.length > 0 && (
            <div className="bg-slate-800 p-6 rounded-xl border border-emerald-500/50 shadow-lg shadow-emerald-900/20">
              <h3 className="text-lg font-bold text-emerald-400 mb-4">Konfirmasi Data Nota</h3>
              <p className="text-sm text-slate-400 mb-4">Periksa dan lengkapi data sebelum disimpan. Stok akan otomatis bertambah jika barang sudah ada.</p>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {scannedItems.map((item, index) => (
                  <div key={index} className="p-3 bg-slate-900/50 rounded-lg border border-slate-700 text-sm">
                    <div className="mb-2">
                        <label className="block text-xs text-slate-500">Nama Barang (AI)</label>
                        <input type="text" value={item.nama_barang} onChange={(e) => handleScannedItemChange(index, 'nama_barang', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                        <div>
                            <label className="block text-xs text-slate-500">Qty (AI)</label>
                            <input type="number" value={item.qty} onChange={(e) => handleScannedItemChange(index, 'qty', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white font-bold text-emerald-400" />
                        </div>
                        <div className="col-span-2">
                             <label className="block text-xs text-slate-500">Harga Beli Satuan (AI)</label>
                             <input type="number" value={item.harga_beli_satuan} onChange={(e) => handleScannedItemChange(index, 'harga_beli_satuan', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs text-slate-400">Kategori (Manual)</label>
                            <input type="text" value={item.kategori} onChange={(e) => handleScannedItemChange(index, 'kategori', e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white placeholder-slate-600" placeholder="Misal: Oli" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400">Harga Jual (Manual)</label>
                            <input type="number" value={item.harga_jual} onChange={(e) => handleScannedItemChange(index, 'harga_jual', e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white placeholder-slate-600" placeholder="0" />
                        </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={handleSaveScannedItems} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded flex justify-center items-center gap-2 mt-4 transition-colors">
                {loading ? <Loader2 className="animate-spin size={18}" /> : <><Save size={18}/> Simpan Semua Barang</>}
              </button>
            </div>
          )}
        </div>

        {/* Kolom Kanan: Daftar Inventaris Gudang */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col h-full max-h-[80vh]">
             <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                 <h3 className="font-bold text-lg">Stok Gudang Saat Ini</h3>
                 {/* (Opsional) Bisa tambahkan tombol tambah manual atau search bar di sini */}
                 <div className="flex gap-2">
                     <button className="p-2 bg-slate-800 border border-slate-700 rounded text-slate-400 hover:text-white"><Search size={16}/></button>
                     <button className="p-2 bg-emerald-900/30 text-emerald-400 border border-emerald-900 rounded hover:bg-emerald-900/50 flex items-center gap-1 text-xs font-bold"><Plus size={14}/> Tambah Manual</button>
                 </div>
             </div>
             <div className="overflow-y-auto custom-scrollbar flex-1">
                 <table className="w-full text-sm text-left text-slate-400">
                    <thead className="text-xs text-slate-200 uppercase bg-slate-900/80 sticky top-0">
                        <tr>
                            <th className="px-6 py-3">Barang</th>
                            <th className="px-4 py-3 text-center">Stok</th>
                            <th className="px-4 py-3 text-right">Harga Beli</th>
                            <th className="px-4 py-3 text-right">Harga Jual</th>
                            {/* <th className="px-4 py-3 text-right">Aksi</th> */}
                        </tr>
                    </thead>
                    <tbody>
                        {loading && inventory.length === 0 && (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500"><Loader2 className="animate-spin mx-auto mb-2"/>Memuat data gudang...</td></tr>
                        )}
                        {!loading && inventory.length === 0 && (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Gudang masih kosong. Silakan scan nota atau tambah barang.</td></tr>
                        )}
                        {inventory.map((item) => (
                            <tr key={item.id} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-white">{item.nama_barang}</div>
                                    <div className="text-xs mt-1 flex gap-2">
                                        {item.kategori && <span className="bg-slate-700 px-2 py-0.5 rounded text-slate-300">{item.kategori}</span>}
                                        {item.supplier && <span className="text-slate-500 flex items-center gap-1">🏠 {item.supplier}</span>}
                                    </div>
                                </td>
                                <td className={`px-4 py-4 text-center font-bold text-lg ${item.stok < 5 ? 'text-red-400 bg-red-900/10 rounded' : 'text-emerald-400'}`}>{item.stok}</td>
                                <td className="px-4 py-4 text-right font-mono">{item.harga_beli ? `Rp ${parseInt(item.harga_beli).toLocaleString('id-ID')}` : '-'}</td>
                                <td className="px-4 py-4 text-right font-mono text-white">{item.harga_jual ? `Rp ${parseInt(item.harga_jual).toLocaleString('id-ID')}` : '-'}</td>
                                {/* <td className="px-4 py-4 text-right"><button className="text-slate-500 hover:text-white"><MoreVertical size={16}/></button></td> */}
                            </tr>
                        ))}
                    </tbody>
                 </table>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}