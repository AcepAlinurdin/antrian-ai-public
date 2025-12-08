import React, { useState, useEffect } from 'react';
import { Loader2, UploadCloud, Save, Trash2, Package, Sparkles, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import PageHeader from '../components/PageHeader';

export default function InventoryPage({ onNavigate }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    nama_barang: '',
    kategori: '',
    harga_beli: 0,
    harga_jual: 0,
    stok: 0,
    supplier: ''
  });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    const { data } = await supabase.from('Inventory').select('*').order('created_at', { ascending: false });
    if (data) setItems(data);
  };

  // --- LOGIKA UTAMA: Handle Image Upload & AI ---
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    
    // 1. Convert File ke Base64 (Syarat kirim ke API)
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64String = reader.result.split(',')[1]; // Hapus prefix "data:image/..."
      const mimeType = file.type;

      try {
        // 2. Kirim ke Backend AI Vision
        const response = await fetch('/api/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64String, mimeType }),
        });

        if (!response.ok) throw new Error('Gagal scan gambar');

        const aiData = await response.json();

        // 3. Auto-fill Form dengan data AI
        setFormData({
          nama_barang: aiData.nama_barang || '',
          kategori: aiData.kategori || 'Umum',
          harga_beli: aiData.harga_beli || 0,
          harga_jual: aiData.harga_jual_estimasi || 0,
          stok: aiData.stok || 1,
          supplier: aiData.supplier || ''
        });

        alert("✨ Data berhasil diekstrak AI! Silakan cek dan simpan.");

      } catch (error) {
        console.error(error);
        alert("Gagal menganalisa gambar. Coba foto yang lebih jelas.");
      } finally {
        setAnalyzing(false);
      }
    };
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('Inventory').insert([formData]);
    if (error) {
      alert("Gagal menyimpan: " + error.message);
    } else {
      fetchInventory();
      setFormData({ nama_barang: '', kategori: '', harga_beli: 0, harga_jual: 0, stok: 0, supplier: '' }); // Reset
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if(confirm("Hapus barang ini?")) {
        await supabase.from('Inventory').delete().eq('id', id);
        fetchInventory();
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-mono">
      <PageHeader 
        title="Manajemen Gudang" 
        subtitle="Input barang manual atau Scan Faktur via AI" 
        icon={Package}
        actions={
          <button onClick={() => onNavigate('admin')} className="px-4 py-2 text-slate-400 hover:text-white border border-slate-700 rounded-lg flex items-center gap-2 text-sm transition">
            <ArrowLeft size={16}/> Kembali
          </button>
        }
      />

      <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-8">
        {/* Form Input Section */}
        <div className="lg:col-span-1">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 sticky top-6">
                
                {/* AI Upload Area */}
                <div className="mb-6">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-emerald-500/50 border-dashed rounded-lg cursor-pointer bg-slate-900/50 hover:bg-slate-900 transition relative overflow-hidden group">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            {analyzing ? (
                                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
                            ) : (
                                <Sparkles className="w-8 h-8 text-emerald-500 mb-2 group-hover:scale-110 transition" />
                            )}
                            <p className="text-xs text-slate-400 text-center px-4">
                                {analyzing ? "Gemini sedang membaca foto..." : "Upload Foto Faktur / Barang (Auto-Input AI)"}
                            </p>
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={analyzing} />
                    </label>
                </div>

                <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">Input / Edit Data</h3>
                <form onSubmit={handleSave} className="space-y-3">
                    <div>
                        <label className="text-xs text-slate-400">Nama Barang</label>
                        <input type="text" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" 
                            value={formData.nama_barang} onChange={e => setFormData({...formData, nama_barang: e.target.value})} required />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-slate-400">Kategori</label>
                            <input type="text" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" 
                                value={formData.kategori} onChange={e => setFormData({...formData, kategori: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400">Stok</label>
                            <input type="number" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" 
                                value={formData.stok} onChange={e => setFormData({...formData, stok: e.target.value})} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-slate-400">Harga Beli</label>
                            <input type="number" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" 
                                value={formData.harga_beli} onChange={e => setFormData({...formData, harga_beli: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400">Harga Jual</label>
                            <input type="number" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" 
                                value={formData.harga_jual} onChange={e => setFormData({...formData, harga_jual: e.target.value})} />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400">Supplier</label>
                        <input type="text" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" 
                            value={formData.supplier} onChange={e => setFormData({...formData, supplier: e.target.value})} />
                    </div>

                    <button disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded flex justify-center items-center gap-2 mt-4">
                        {loading ? <Loader2 className="animate-spin size={18}" /> : <><Save size={18}/> Simpan Barang</>}
                    </button>
                </form>
            </div>
        </div>

        {/* Inventory List Section */}
        <div className="lg:col-span-2">
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full text-sm text-left text-slate-400">
                    <thead className="text-xs text-slate-200 uppercase bg-slate-900/50">
                        <tr>
                            <th className="px-6 py-3">Nama Barang</th>
                            <th className="px-6 py-3">Kategori</th>
                            <th className="px-6 py-3">Stok</th>
                            <th className="px-6 py-3">Harga Jual</th>
                            <th className="px-6 py-3 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 && (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Gudang kosong.</td></tr>
                        )}
                        {items.map((item) => (
                            <tr key={item.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                                <td className="px-6 py-4 font-medium text-white">{item.nama_barang}</td>
                                <td className="px-6 py-4"><span className="bg-slate-700 px-2 py-1 rounded text-xs text-white">{item.kategori}</span></td>
                                <td className={`px-6 py-4 font-bold ${item.stok < 5 ? 'text-red-400' : 'text-emerald-400'}`}>{item.stok}</td>
                                <td className="px-6 py-4">Rp {parseInt(item.harga_jual).toLocaleString('id-ID')}</td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-300"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
}