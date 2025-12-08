import React, { useState, useEffect } from 'react';
import { 
  Loader2, Bot, User, Clock, CheckCircle, PauseCircle, 
  Trash2, LogOut, Lock, Play, ArrowLeft, Wrench, LogIn, 
  FileText, History, Package, Sparkles, Save, UploadCloud, Plus, X 
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// ==========================================
// 1. CONFIG & GLOBAL VARIABLES
// ==========================================

const getEnv = (key) => {
  try { return import.meta.env[key]; } catch (e) { return ''; }
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || '';
const SUPABASE_KEY = getEnv('VITE_SUPABASE_KEY') || '';

// Variabel Global untuk Supabase (diisi nanti setelah script load)
let supabase = null;

const MAX_MECHANICS = 2;

const getTodayDate = () => new Date().toISOString().split('T')[0];
const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

const checkAndFillSlots = async () => {
  if (!supabase) return;
  try {
    const today = getTodayDate();
    const { count: processingCount } = await supabase
      .from('Antrian')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing')
      .gte('created_at', today);

    if ((processingCount || 0) < MAX_MECHANICS) {
      const slotsAvailable = MAX_MECHANICS - (processingCount || 0);
      const { data: nextInLine } = await supabase
        .from('Antrian')
        .select('*')
        .eq('status', 'waiting')
        .gte('created_at', today)
        .order('created_at', { ascending: true })
        .limit(slotsAvailable);

      if (nextInLine && nextInLine.length > 0) {
        for (let item of nextInLine) {
          await supabase.from('Antrian').update({ status: 'processing' }).eq('id', item.id);
        }
      }
    }
  } catch (err) {
    console.error("Auto-fill error:", err);
  }
};

// ==========================================
// 2. REUSABLE COMPONENTS
// ==========================================

const PageHeader = ({ title, subtitle, icon: Icon, actions }) => (
  <div className="max-w-6xl mx-auto mb-8 flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-slate-700 pb-6">
    <div className="text-center sm:text-left">
      <h1 className="text-3xl font-bold flex items-center justify-center sm:justify-start gap-3 text-cyan-400">
        <Icon size={32} /> {title}
      </h1>
      <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
    </div>
    <div className="flex gap-3">{actions}</div>
  </div>
);

const MechanicStatus = ({ activeMechanics }) => (
  <div className="grid grid-cols-2 gap-4 mb-6">
    {[1, 2].map(num => (
      <div key={num} className={`p-3 rounded border flex items-center gap-3 transition-colors ${activeMechanics >= num ? 'bg-blue-900/20 border-blue-500' : 'bg-slate-800 border-slate-700 opacity-50'}`}>
        <Wrench size={20} className={activeMechanics >= num ? "text-blue-400" : "text-slate-500"} />
        <span className="text-sm font-bold">{activeMechanics >= num ? `Mekanik ${num} Sibuk` : `Mekanik ${num} Ready`}</span>
      </div>
    ))}
  </div>
);

const TicketCard = ({ item, isAdmin = false, onAction, onDelete }) => {
  const statusColors = {
    processing: 'border-blue-500 bg-slate-800/80 ring-1 ring-blue-500/50',
    done: 'border-emerald-500 opacity-60',
    pending: 'border-amber-500 opacity-80',
    waiting: 'border-slate-500'
  };

  const badgeColors = {
    processing: 'bg-blue-600',
    done: 'bg-emerald-600',
    pending: 'bg-amber-600',
    waiting: 'bg-slate-700 text-slate-300'
  };

  return (
    <div className={`relative bg-slate-800 p-5 rounded-lg border-l-4 shadow-lg transition ${statusColors[item.status] || 'border-slate-500'}`}>
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
        <div className="flex flex-row sm:flex-col items-center justify-between sm:justify-center bg-slate-900/50 p-3 rounded-lg border border-slate-700 w-full sm:w-auto sm:min-w-[80px]">
          <span className="text-xs text-slate-500 uppercase">Nomor</span>
          <span className="text-3xl font-bold text-white tracking-tighter">A-{String(item.no_antrian || 0).padStart(3, '0')}</span>
        </div>

        <div className="flex-1 w-full">
          <h3 className="font-bold text-lg text-white flex items-center gap-2">
            <User size={18} /> {item.costumer_name}
            <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold text-white ${badgeColors[item.status]}`}>
              {item.status}
            </span>
          </h3>
          <p className="text-slate-400 mt-1 text-sm">{item.issue}</p>
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500 bg-slate-900/30 p-2 rounded w-fit">
            <span className="text-emerald-400 font-semibold flex items-center gap-1"><Bot size={14}/> {item.ai_analysis}</span>
            <span className="text-amber-400 font-semibold flex items-center gap-1 border-l border-slate-600 pl-3"><Clock size={14}/> ± {item.estimated_mins} Mins</span>
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-col gap-2 w-full sm:w-auto sm:pl-4 sm:border-l border-slate-700 sm:min-w-[140px] pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-700">
            {item.status === 'processing' && (
              <>
                <button onClick={() => onAction(item.id, 'done')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded flex items-center justify-center gap-2 text-xs font-bold shadow-lg w-full transition-colors">
                  <CheckCircle size={16}/> SELESAI
                </button>
                <button onClick={() => onAction(item.id, 'pending')} className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded flex items-center justify-center gap-2 text-xs font-bold shadow-lg w-full transition-colors">
                  <PauseCircle size={16}/> PENDING
                </button>
              </>
            )}
            {item.status === 'pending' && (
              <button onClick={() => onAction(item.id, 'resume')} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded flex items-center justify-center gap-2 text-xs font-bold shadow-lg animate-pulse w-full transition-colors">
                <Play size={16}/> RESUME
              </button>
            )}
            {(item.status === 'waiting' || item.status === 'done') && (
              <button onClick={() => onDelete(item.id)} className="bg-red-900/20 hover:bg-red-900 text-red-400 p-2 rounded flex justify-center w-full transition-colors" title="Hapus Data">
                <Trash2 size={18}/>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 3. PAGES
// ==========================================

// --- INVENTORY PAGE ---
const InventoryPage = ({ onNavigate }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  
  // State untuk form manual
  const [formData, setFormData] = useState({
    nama_barang: '', kategori: '', harga_beli: 0, harga_jual: 0, stok: 0, supplier: ''
  });

  // State untuk hasil scan nota (Array of items)
  const [scannedItems, setScannedItems] = useState([]);

  useEffect(() => { if (supabase) fetchInventory(); }, []);

  const fetchInventory = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('Inventory').select('*').order('created_at', { ascending: false });
    if (data) setItems(data);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    
    // SIMULASI: Dalam app nyata, ini kirim ke /api/analyze-invoice
    // Kita simulasikan respon AI yang mendeteksi BANYAK barang dari nota AHASS
    setTimeout(() => {
      const mockDetectedItems = [
        { nama_barang: 'BAN LUAR BELAKANG', kategori: 'Sparepart', harga_beli: 35000, harga_jual: 41000, stok: 1, supplier: 'AHASS Gunung Sahari' },
        { nama_barang: 'ELEMENT COMP, AIR/C (17210K59A70)', kategori: 'Sparepart', harga_beli: 50000, harga_jual: 62000, stok: 1, supplier: 'AHASS Gunung Sahari' },
        { nama_barang: 'PIECE SET, SLIDE (22011KWN900)', kategori: 'Sparepart', harga_beli: 18000, harga_jual: 22000, stok: 1, supplier: 'AHASS Gunung Sahari' },
        { nama_barang: 'OIL SEAL 26X45X6 (91202KWN901)', kategori: 'Sparepart', harga_beli: 8000, harga_jual: 10500, stok: 1, supplier: 'AHASS Gunung Sahari' },
        { nama_barang: 'ROLLER WEIGHT SET (2212AK36T00)', kategori: 'Sparepart', harga_beli: 42000, harga_jual: 51500, stok: 1, supplier: 'AHASS Gunung Sahari' },
        { nama_barang: 'SPARK PLUG CPR9EA9 (NGK)', kategori: 'Sparepart', harga_beli: 15000, harga_jual: 21500, stok: 1, supplier: 'AHASS Gunung Sahari' }
      ];
      
      setScannedItems(mockDetectedItems);
      alert(`✨ Gemini AI berhasil mengekstrak ${mockDetectedItems.length} item dari nota!`);
      setAnalyzing(false);
    }, 2500);
  };

  const handleScannedItemChange = (index, field, value) => {
    const updated = [...scannedItems];
    updated[index] = { ...updated[index], [field]: value };
    setScannedItems(updated);
  };

  const removeScannedItem = (index) => {
    const updated = scannedItems.filter((_, i) => i !== index);
    setScannedItems(updated);
  };

  const handleSaveScannedItems = async () => {
    if (!supabase) return alert("Koneksi Supabase belum disetup.");
    setLoading(true);

    try {
      let savedCount = 0;
      let updatedCount = 0;

      for (const item of scannedItems) {
        // 1. Cek apakah barang sudah ada di DB (Case insensitive)
        const { data: existingItem } = await supabase
          .from('Inventory')
          .select('id, stok')
          .ilike('nama_barang', item.nama_barang)
          .maybeSingle();

        if (existingItem) {
          // 2. Jika ADA: Update Stok (Stok Lama + Stok Baru)
          const newStok = (existingItem.stok || 0) + parseInt(item.stok);
          await supabase
            .from('Inventory')
            .update({ stok: newStok, harga_beli: item.harga_beli, supplier: item.supplier })
            .eq('id', existingItem.id);
          updatedCount++;
        } else {
          // 3. Jika TIDAK ADA: Insert Barang Baru
          await supabase.from('Inventory').insert([item]);
          savedCount++;
        }
      }

      alert(`Proses Selesai!\n✅ ${savedCount} Barang Baru Ditambahkan\n🔄 ${updatedCount} Stok Barang Diupdate`);
      setScannedItems([]); // Clear form
      fetchInventory(); // Refresh table
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan data.");
    } finally {
      setLoading(false);
    }
  };

  // Fungsi simpan manual (satu item)
  const handleManualSave = async (e) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.from('Inventory').insert([formData]);
    if (error) alert("Error: " + error.message);
    else {
      fetchInventory();
      setFormData({ nama_barang: '', kategori: '', harga_beli: 0, harga_jual: 0, stok: 0, supplier: '' });
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if(confirm("Hapus barang ini?")) {
        await supabase.from('Inventory').delete().eq('id', id);
        fetchInventory();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-mono">
      <PageHeader title="Manajemen Gudang" subtitle="Input barang manual atau Scan Nota via AI" icon={Package} 
        actions={<button onClick={() => onNavigate('admin')} className="px-4 py-2 text-slate-400 hover:text-white border border-slate-700 rounded-lg flex items-center gap-2 text-sm transition"><ArrowLeft size={16}/> Kembali</button>} />
      
      <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-8">
        
        {/* KOLOM KIRI: FORM INPUT / SCAN HASIL */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* AREA UPLOAD GAMBAR */}
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">1. Scan Nota (Otomatis)</h3>
            <div className="mb-2">
                <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition relative overflow-hidden group ${analyzing ? 'border-emerald-500 bg-emerald-900/10' : 'border-slate-600 bg-slate-900/50 hover:bg-slate-900'}`}>
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {analyzing ? <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-2" /> : <Sparkles className="w-8 h-8 text-emerald-500 mb-2 group-hover:scale-110 transition" />}
                        <p className="text-xs text-slate-400 text-center px-4">{analyzing ? "Gemini sedang membaca nota..." : "Klik untuk Upload Foto Nota"}</p>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={analyzing} />
                </label>
            </div>
          </div>

          {/* JIKA ADA HASIL SCAN: TAMPILKAN LIST EDITOR */}
          {scannedItems.length > 0 ? (
             <div className="bg-slate-800 p-4 rounded-xl border border-emerald-500/50 shadow-lg shadow-emerald-900/20 max-h-[600px] overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                  <h3 className="text-md font-bold text-white text-emerald-400">Hasil Scan ({scannedItems.length})</h3>
                  <button onClick={() => setScannedItems([])} className="text-xs text-red-400 hover:underline">Batal</button>
                </div>
                
                <div className="space-y-4">
                  {scannedItems.map((item, idx) => (
                    <div key={idx} className="bg-slate-900/80 p-3 rounded border border-slate-700 relative group">
                      <button onClick={() => removeScannedItem(idx)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"><X size={14}/></button>
                      
                      <div className="space-y-3">
                        {/* Nama Barang */}
                        <div>
                          <label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">Nama Barang</label>
                          <input type="text" className="w-full bg-transparent border-b border-slate-700 text-sm font-bold text-white focus:border-emerald-500 outline-none pb-1" 
                            value={item.nama_barang} onChange={e => handleScannedItemChange(idx, 'nama_barang', e.target.value)} />
                        </div>
                        
                        <div className="flex gap-3">
                           <div className="w-1/3">
                             <label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">Qty</label>
                             <input type="number" className="w-full bg-slate-800 rounded px-2 py-1 text-xs text-white border border-slate-600" 
                               value={item.stok} onChange={e => handleScannedItemChange(idx, 'stok', e.target.value)} />
                           </div>
                           <div className="w-2/3">
                             <label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">Kategori</label>
                             <input type="text" className="w-full bg-slate-800 rounded px-2 py-1 text-xs text-white border border-slate-600" 
                               value={item.kategori} onChange={e => handleScannedItemChange(idx, 'kategori', e.target.value)} />
                           </div>
                        </div>

                        <div className="flex gap-3">
                           <div className="w-1/2">
                             <label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">Harga Beli</label>
                             <input type="number" className="w-full bg-slate-800 rounded px-2 py-1 text-xs text-white border border-slate-600" 
                               value={item.harga_beli} onChange={e => handleScannedItemChange(idx, 'harga_beli', e.target.value)} />
                           </div>
                           <div className="w-1/2">
                             <label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">Harga Jual</label>
                             <input type="number" className="w-full bg-slate-800 rounded px-2 py-1 text-xs text-white border border-slate-600" 
                               value={item.harga_jual} onChange={e => handleScannedItemChange(idx, 'harga_jual', e.target.value)} />
                           </div>
                        </div>

                        {/* Supplier */}
                        <div>
                          <label className="text-[10px] uppercase text-slate-500 font-bold mb-1 block">Supplier</label>
                          <input type="text" className="w-full bg-slate-800 rounded px-2 py-1 text-xs text-white border border-slate-600" 
                            value={item.supplier} onChange={e => handleScannedItemChange(idx, 'supplier', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={handleSaveScannedItems} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded flex justify-center items-center gap-2 mt-4 sticky bottom-0 shadow-lg">
                    {loading ? <Loader2 className="animate-spin size={18}" /> : <><Save size={18}/> Simpan Semua ke Gudang</>}
                </button>
             </div>
          ) : (
            /* JIKA TIDAK ADA HASIL SCAN: TAMPILKAN FORM MANUAL */
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">2. Input Manual</h3>
                <form onSubmit={handleManualSave} className="space-y-3">
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Nama Barang</label>
                        <input type="text" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" value={formData.nama_barang} onChange={e => setFormData({...formData, nama_barang: e.target.value})} required />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Kategori</label>
                            <input type="text" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" value={formData.kategori} onChange={e => setFormData({...formData, kategori: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Stok (Qty)</label>
                            <input type="number" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" value={formData.stok} onChange={e => setFormData({...formData, stok: e.target.value})} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Harga Beli</label>
                            <input type="number" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" value={formData.harga_beli} onChange={e => setFormData({...formData, harga_beli: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Harga Jual</label>
                            <input type="number" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" value={formData.harga_jual} onChange={e => setFormData({...formData, harga_jual: e.target.value})} />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Supplier</label>
                        <input type="text" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" value={formData.supplier} onChange={e => setFormData({...formData, supplier: e.target.value})} />
                    </div>
                    <button disabled={loading} className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded flex justify-center items-center gap-2 mt-2 text-sm">{loading ? <Loader2 className="animate-spin size={16}" /> : <><Plus size={16}/> Tambah Manual</>}</button>
                </form>
            </div>
          )}
        </div>

        {/* KOLOM KANAN: TABEL GUDANG */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden h-full flex flex-col">
             <div className="p-4 border-b border-slate-700 bg-slate-900/50">
                <h3 className="font-bold text-lg text-white">Stok Gudang</h3>
             </div>
             <div className="overflow-y-auto flex-1">
                <table className="w-full text-sm text-left text-slate-400">
                    <thead className="text-xs text-slate-200 uppercase bg-slate-900/50 sticky top-0"><tr><th className="px-6 py-3">Barang</th><th className="px-6 py-3 text-center">Stok</th><th className="px-6 py-3 text-right">Harga Jual</th><th className="px-6 py-3 text-right">Aksi</th></tr></thead>
                    <tbody>
                        {items.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">Gudang kosong.</td></tr>}
                        {items.map((item) => (
                            <tr key={item.id} className="border-b border-slate-700 hover:bg-slate-700/50 transition">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-white">{item.nama_barang}</div>
                                    <div className="text-xs mt-1 flex gap-2">
                                        <span className="bg-slate-700 px-2 py-0.5 rounded text-slate-300">{item.kategori || 'Umum'}</span>
                                        {item.supplier && <span className="text-slate-500 flex items-center gap-1">🏠 {item.supplier}</span>}
                                    </div>
                                </td>
                                <td className={`px-6 py-4 font-bold text-center text-lg ${item.stok < 5 ? 'text-red-400 bg-red-900/10 rounded' : 'text-emerald-400'}`}>{item.stok}</td>
                                <td className="px-6 py-4 text-right font-mono text-white">Rp {parseInt(item.harga_jual).toLocaleString('id-ID')}</td>
                                <td className="px-6 py-4 text-right"><button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-300 bg-red-900/20 p-2 rounded hover:bg-red-900/40 transition"><Trash2 size={16}/></button></td>
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
};

// --- USER PAGE ---
const UserPage = ({ onNavigate }) => {
  const [name, setName] = useState('');
  const [issue, setIssue] = useState('');
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState([]);
  const activeMechanics = queue.filter(q => q.status === 'processing').length;

  useEffect(() => {
    if (!supabase) return;
    const fetchQueue = async () => {
      const today = getTodayDate();
      const { data } = await supabase.from('Antrian').select('*').gte('created_at', today).order('created_at', { ascending: true });
      if (data) setQueue(data);
    };
    fetchQueue();
    const channel = supabase.channel('realtime-queue-user').on('postgres_changes', { event: '*', schema: 'public', table: 'Antrian' }, () => { fetchQueue(); setTimeout(checkAndFillSlots, 1000); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleJoinQueue = async (e) => {
    e.preventDefault();
    if (!name || !issue) return;
    setLoading(true);
    try {
      const today = getTodayDate();
      const { count } = await supabase.from('Antrian').select('*', { count: 'exact', head: true }).gte('created_at', today);
      const nextNumber = (count || 0) + 1;
      let aiSummary = "Menunggu Analisa", estMins = 30, isValid = false;

      // Simulasi Backend Call (untuk Preview)
      try {
        // Asumsikan backend tidak bisa diakses di preview, jadi langsung fallback
        throw new Error("Backend unavailable in preview");
      } catch (err) {
        console.warn("Backend Error, Fallback Manual:", err);
        const keywords = ['rem','ban','oli','mesin','servis','lampu','busi','aki','karbu','cvt','kampas','rantai','bensin','stater','starter','gas','spion','jok'];
        isValid = keywords.some(w => issue.toLowerCase().includes(w));
        aiSummary = isValid ? "Validasi Manual (Server Sibuk)" : "Gunakan kata kunci motor";
      }

      if (!isValid) {
        alert(`❌ Ditolak: ${aiSummary}`);
        setLoading(false); return;
      }

      const { error } = await supabase.from('Antrian').insert([{ costumer_name: name, issue, ai_analysis: aiSummary, estimated_mins: estMins, status: 'waiting', no_antrian: nextNumber }]);
      if (error) throw error;
      setName(''); setIssue('');
      alert(`✅ Berhasil! Nomor: A-${nextNumber}`);
      setTimeout(checkAndFillSlots, 500);
    } catch (error) { console.error(error); alert("Gagal memproses."); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-mono">
      <PageHeader title="System Antrian AI" subtitle="Selamat Datang, Silahkan Ambil Nomor." icon={Bot} actions={<button onClick={() => onNavigate('login')} className="px-4 py-2 bg-slate-800 hover:text-cyan-400 rounded-lg text-sm border border-slate-700 flex items-center gap-2 transition"><LogIn size={16} /> Staff Login</button>} />
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1">
          <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 sticky top-6">
            <h2 className="text-xl font-bold mb-4 text-emerald-400">Ambil Nomor</h2>
            <form onSubmit={handleJoinQueue} className="space-y-4">
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" placeholder="Nama Kamu" />
              <textarea value={issue} onChange={e => setIssue(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 outline-none h-32 text-white" placeholder="Keluhan Motor..." />
              <button disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded flex justify-center items-center gap-2">{loading ? <Loader2 className="animate-spin" /> : 'Ambil Antrian'}</button>
            </form>
          </div>
        </div>
        <div className="lg:col-span-2">
          <MechanicStatus activeMechanics={activeMechanics} />
          <div className="grid gap-4">{queue.length === 0 && <p className="text-center text-slate-500 py-10">Belum ada antrian.</p>}{queue.map((item) => <TicketCard key={item.id} item={item} />)}</div>
        </div>
      </div>
    </div>
  );
};

// --- ADMIN PAGE ---
const AdminPage = ({ onNavigate }) => {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => { if (!session) onNavigate('login'); else setLoading(false); });
    const fetchQueue = async () => { const today = getTodayDate(); const { data } = await supabase.from('Antrian').select('*').gte('created_at', today).order('created_at', { ascending: true }); if (data) setQueue(data); };
    fetchQueue();
    const channel = supabase.channel('realtime-queue-admin').on('postgres_changes', { event: '*', schema: 'public', table: 'Antrian' }, () => { fetchQueue(); setTimeout(checkAndFillSlots, 1000); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [onNavigate]);

  const handleAction = async (id, action) => { const newStatus = action === 'resume' ? 'waiting' : action; await supabase.from('Antrian').update({ status: newStatus }).eq('id', id); if (action === 'done') setTimeout(checkAndFillSlots, 500); };
  const handleDelete = async (id) => { if (confirm("Hapus permanen?")) await supabase.from('Antrian').delete().eq('id', id); };
  const handleLogout = async () => { await supabase.auth.signOut(); onNavigate('user'); };

  if (loading) return <div className="min-h-screen bg-slate-900 flex justify-center items-center text-white"><Loader2 className="animate-spin"/></div>;
  const activeMechanics = queue.filter(q => q.status === 'processing').length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 font-mono">
      <PageHeader title="Admin Dashboard" subtitle={`Hari ini: ${formatDate(new Date())}`} icon={Bot} actions={<>
        <button onClick={() => onNavigate('inventory')} className="px-4 py-2 bg-slate-800 text-emerald-400 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center gap-2 text-sm transition"><Package size={16}/> Gudang</button>
        <button onClick={() => onNavigate('recap')} className="px-4 py-2 bg-slate-800 hover:text-cyan-300 border border-slate-700 rounded-lg flex items-center gap-2 text-sm transition"><FileText size={16}/> Rekap</button>
        <button onClick={() => onNavigate('user')} className="px-4 py-2 hover:text-white border border-slate-700 rounded-lg flex items-center gap-2 text-sm transition"><ArrowLeft size={16}/> User View</button>
        <button onClick={handleLogout} className="px-4 py-2 bg-red-900/30 text-red-400 hover:bg-red-900 border border-red-900 rounded-lg flex items-center gap-2 text-sm transition"><LogOut size={16} /> Logout</button>
      </>} />
      <div className="max-w-5xl mx-auto"><MechanicStatus activeMechanics={activeMechanics} /><div className="grid gap-4">{queue.length === 0 && <p className="text-slate-500 text-center py-10 bg-slate-800/30 rounded">Tidak ada antrian aktif.</p>}{queue.map((item) => <TicketCard key={item.id} item={item} isAdmin={true} onAction={handleAction} onDelete={handleDelete} />)}</div></div>
    </div>
  );
};

// --- RECAP PAGE ---
const RecapPage = ({ onNavigate }) => {
  const [dataDone, setDataDone] = useState([]);
  const [dataPending, setDataPending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    const fetchData = async () => {
      setLoading(true);
      const today = getTodayDate();
      const { data } = await supabase.from('Antrian').select('*').lt('created_at', today).order('created_at', { ascending: false });
      if (data) { setDataDone(data.filter(i => i.status === 'done')); setDataPending(data.filter(i => i.status !== 'done')); }
      setLoading(false);
    };
    fetchData();
  }, []);

  const HistoryItem = ({ item }) => (
    <div className="bg-slate-800 p-3 rounded border border-slate-700 text-sm opacity-90 hover:opacity-100 transition">
      <div className="flex justify-between items-start mb-1"><span className="font-bold text-slate-300">{item.costumer_name}</span><span className="text-xs text-slate-500">{formatDate(item.created_at)}</span></div>
      <p className="text-slate-500 text-xs mb-2">{item.issue}</p>
      <div className="flex justify-between items-center text-xs"><span className={`uppercase font-bold ${item.status === 'done' ? 'text-emerald-500' : 'text-amber-500'}`}>{item.status}</span><span>A-{String(item.no_antrian).padStart(3,'0')}</span></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-mono">
      <PageHeader title="Rekapitulasi" subtitle="Data pekerjaan hari-hari sebelumnya" icon={History} actions={<button onClick={() => onNavigate('admin')} className="px-4 py-2 text-slate-400 hover:text-white border border-slate-700 rounded-lg flex items-center gap-2 text-sm transition"><ArrowLeft size={16}/> Kembali ke Admin</button>} />
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
        <div className="bg-slate-800/50 p-6 rounded-xl border border-amber-900/30"><h2 className="text-xl font-bold text-amber-500 mb-4 flex items-center gap-2"><PauseCircle size={20}/> Masih Pending</h2>{loading ? <Loader2 className="animate-spin text-slate-500"/> : dataPending.length === 0 ? <p className="text-slate-500 italic text-sm">Nihil.</p> : <div className="space-y-3">{dataPending.map(item => <HistoryItem key={item.id} item={item} />)}</div>}</div>
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700"><h2 className="text-xl font-bold text-emerald-500 mb-4 flex items-center gap-2"><CheckCircle size={20}/> Riwayat Selesai</h2>{loading ? <Loader2 className="animate-spin text-slate-500"/> : dataDone.length === 0 ? <p className="text-slate-500 italic text-sm">Nihil.</p> : <div className="space-y-3 h-[500px] overflow-y-auto pr-2 custom-scrollbar">{dataDone.map(item => <HistoryItem key={item.id} item={item} />)}</div>}</div>
      </div>
    </div>
  );
};

// --- LOGIN PAGE ---
const LoginPage = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const handleLogin = async (e) => { e.preventDefault(); setLoading(true); const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) alert(error.message); else onNavigate('admin'); setLoading(false); };
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-mono">
      <div className="bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700 w-full max-w-md">
        <button onClick={() => onNavigate('user')} className="text-slate-400 hover:text-white flex items-center gap-1 text-sm mb-6 transition"><ArrowLeft size={16} /> Kembali</button>
        <div className="text-center mb-8"><div className="bg-red-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400 ring-2 ring-red-900"><Lock size={32} /></div><h1 className="text-2xl font-bold text-white">Admin Access</h1></div>
        <form onSubmit={handleLogin} className="space-y-4"><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white" placeholder="admin@bengkel.com" /><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white" placeholder="••••••••" /><button disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded flex justify-center items-center">{loading ? <Loader2 className="animate-spin" /> : 'Masuk Dashboard'}</button></form>
      </div>
    </div>
  );
};

// ==========================================
// 4. MAIN APP ROUTING
// ==========================================

export default function App() {
  const [currentView, setCurrentView] = useState('user');
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);

  useEffect(() => {
    // Inject Script Supabase untuk Environment ini
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.46.1/dist/umd/supabase.min.js';
    script.async = true;
    script.onload = () => {
      if (window.supabase && SUPABASE_URL && SUPABASE_KEY) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      }
      setIsSupabaseReady(true);
    };
    script.onerror = () => setIsSupabaseReady(true); // Lanjut render untuk nampilin error UI
    document.body.appendChild(script);
  }, []);

  if (!isSupabaseReady) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4 font-mono">
        <Loader2 className="animate-spin" size={48} />
        <p className="animate-pulse">Menghubungkan ke System...</p>
      </div>
    );
  }

  // UI Error jika Config kosong
  if (!supabase) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white text-center font-mono">
        <div className="max-w-md border border-red-500 bg-red-900/20 p-6 rounded-lg">
          <h2 className="text-xl font-bold text-red-400 mb-2">Konfigurasi Hilang</h2>
          <p className="text-sm text-slate-300">Harap isi VITE_SUPABASE_URL dan VITE_SUPABASE_KEY.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {currentView === 'user' && <UserPage onNavigate={setCurrentView} />}
      {currentView === 'login' && <LoginPage onNavigate={setCurrentView} />}
      {currentView === 'admin' && <AdminPage onNavigate={setCurrentView} />}
      {currentView === 'recap' && <RecapPage onNavigate={setCurrentView} />}
      {currentView === 'inventory' && <InventoryPage onNavigate={setCurrentView} />}
    </>
  );
}