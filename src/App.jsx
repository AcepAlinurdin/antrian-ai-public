import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai"; 
import { 
  Loader2, Bot, User, Clock, CheckCircle, PauseCircle, 
  Trash2, LogOut, Lock, Play, ArrowLeft, Wrench, LogIn, 
  FileText, History, Calendar 
} from 'lucide-react';

// --- KONFIGURASI ENV ---
const getEnv = (key) => {
  try {
    return import.meta.env[key];
  } catch (e) {
    return ''; 
  }
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || ''; 
const SUPABASE_KEY = getEnv('VITE_SUPABASE_KEY') || ''; 
const GEMINI_API_KEY = getEnv('VITE_GEMINI_API_KEY') || ''; 

// --- GLOBAL VARIABLES ---
let supabase = null;
const MAX_MECHANICS = 2;

// --- SHARED HELPER FUNCTIONS ---

const getTodayDate = () => new Date().toISOString().split('T')[0];

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

// --- KOMPONEN HALAMAN USER (Updated Logic Validasi) ---

function UserPage({ onNavigate }) {
  const [name, setName] = useState('');
  const [issue, setIssue] = useState('');
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState([]);

  const activeMechanics = queue.filter(q => q.status === 'processing').length;

  useEffect(() => {
    if (!supabase) return;
    fetchQueue();
    
    const channel = supabase
      .channel('realtime-queue-user')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Antrian' }, () => {
        fetchQueue();
        setTimeout(() => checkAndFillSlots(), 1000);
      })
      .subscribe();
      
    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, []);

  const fetchQueue = async () => {
    if (!supabase) return;
    const today = getTodayDate();
    const { data } = await supabase
      .from('Antrian')
      .select('*')
      .gte('created_at', today)
      .order('created_at', { ascending: true });
    if (data) setQueue(data);
  };

  // --- LOGIKA VALIDASI MANUAL (FALLBACK JIKA AI ERROR) ---
  const manualValidation = (text) => {
    const keywords = ['motor', 'rem', 'ban', 'oli', 'mesin', 'servis', 'lampu', 'busi', 'aki', 'karbu', 'cvt', 'kampas', 'rantai', 'bensin', 'starter', 'gas', 'spion', 'plat', 'body', 'jok', 'rusak', 'mogok', 'bunyi'];
    const lowerText = text.toLowerCase();
    const hasKeyword = keywords.some(word => lowerText.includes(word));
    return hasKeyword;
  };

  const handleJoinQueue = async (e) => {
    e.preventDefault();
    if (!supabase) return;
    if (!name || !issue) return;
    setLoading(true);

    try {
      const today = getTodayDate();
      const { count } = await supabase
        .from('Antrian')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);
      
      const nextNumber = (count || 0) + 1;

      // Variabel hasil validasi
      let aiSummary = "Menunggu Analisa";
      let estMins = 30;
      let isValid = false; // Default FALSE agar lebih ketat

      // 1. COBA VALIDASI DENGAN AI GEMINI
      if (GEMINI_API_KEY && GEMINI_API_KEY.length > 10) {
        try {
          const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
          // Gunakan model 1.5-flash yang lebih stabil DENGAN CONFIG JSON
          const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
          });
          
          const prompt = `
            Peran: Kamu adalah Kepala Mekanik Bengkel Motor yang Tegas.
            Analisa keluhan: "${issue}".
            
            Tugas:
            1. Validasi: Apakah ini masalah teknis motor? (Isi chat, sapaan 'p', makanan, curhat -> TOLAK).
            2. Output:
               - Jika VALID: Berikan diagnosis teknis singkat (contoh: "Ganti kampas rem", "Servis CVT").
               - Jika TIDAK VALID: Berikan alasan penolakan yang jelas (contoh: "Maaf, input tidak terdeteksi sebagai kerusakan motor").
            
            Format JSON Wajib: 
            {"valid": boolean, "summary": "string", "mins": number}
          `;
          
          const result = await model.generateContent(prompt);
          const response = await result.response;
          const text = response.text(); // Tidak perlu replace regex berlebihan karena sudah forced JSON
          const aiData = JSON.parse(text);
             
          if (aiData) {
            isValid = aiData.valid;
            aiSummary = aiData.summary;
            estMins = aiData.mins || 30;
          }
        } catch (aiError) {
          console.warn("AI Error/Limit (Switching to Manual):", aiError);
          // 2. JIKA AI ERROR (MISAL API KEY MATI), GUNAKAN VALIDASI MANUAL
          const isManualValid = manualValidation(issue);
          if (isManualValid) {
            isValid = true;
            aiSummary = "Analisa AI Terkendala (Validasi Manual OK)";
          } else {
            isValid = false;
            aiSummary = "Sistem gagal memverifikasi kerusakan. Gunakan kata kunci teknis (rem, mesin, oli).";
          }
        }
      } else {
        // Jika tidak ada API Key, pakai manual
        isValid = manualValidation(issue);
        aiSummary = isValid ? "Validasi Manual" : "Input tidak jelas (Gunakan kata kunci motor)";
      }

      // 3. EKSEKUSI PENOLAKAN / PENERIMAAN
      if (!isValid) {
        alert(`❌ Antrian Ditolak!\n\nAlasan: ${aiSummary || "Input tidak relevan dengan bengkel motor."}\n\nSilakan jelaskan kerusakan motor Anda dengan lebih spesifik.`);
        setLoading(false); 
        return; // STOP DISINI
      }

      const { error } = await supabase.from('Antrian').insert([{
        costumer_name: name, 
        issue: issue, 
        ai_analysis: aiSummary, 
        estimated_mins: estMins, 
        status: 'waiting', 
        no_antrian: nextNumber
      }]);

      if (error) throw error;
      
      setName(''); 
      setIssue('');
      alert(`✅ Berhasil! Nomor Antrian: A-${String(nextNumber).padStart(3, '0')}\nDiagnosa: ${aiSummary}`);
      
      setTimeout(checkAndFillSlots, 500);

    } catch (error) { 
      console.error(error); 
      alert("Gagal memproses antrian. Cek koneksi internet."); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-mono">
      <div className="max-w-6xl mx-auto mb-8 flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-slate-700 pb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-cyan-400">
            <Bot size={32} /> System Antrian berbasis AI
          </h1>
          <p className="text-slate-500 text-sm mt-1">Selamat Datang, Silahkan Ambil Nomor.</p>
        </div>
        <button 
          onClick={() => onNavigate('login')}
          className="px-4 py-2 bg-slate-800 hover:text-cyan-400 rounded-lg text-sm border border-slate-700 flex items-center gap-2 transition"
        >
          <LogIn size={16} /> Staff Login
        </button>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10">
    
        <div className="lg:col-span-1">
          <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 sticky top-6">
            <h2 className="text-xl font-bold mb-4 text-emerald-400">Ambil Nomor</h2>
            <form onSubmit={handleJoinQueue} className="space-y-4">
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-emerald-500 outline-none text-white" 
                placeholder="Nama Kamu" 
              />
              <textarea 
                value={issue} 
                onChange={e => setIssue(e.target.value)} 
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-emerald-500 outline-none h-32 text-white" 
                placeholder="Keluhan Motor (Contoh: Rem bunyi, Ganti Oli)..." 
              />
              <button disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded flex justify-center items-center gap-2">
                {loading ? <Loader2 className="animate-spin" /> : 'Ambil Antrian'}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
    
          <div className="grid grid-cols-2 gap-4 mb-6">
             {[1, 2].map(num => (
               <div key={num} className={`p-3 rounded border flex items-center gap-3 ${activeMechanics >= num ? 'bg-blue-900/20 border-blue-500' : 'bg-slate-800 border-slate-700 opacity-50'}`}>
                 <Wrench size={20} className={activeMechanics >= num ? "text-blue-400" : "text-slate-500"} />
                 <span className="text-sm font-bold">{activeMechanics >= num ? `Mekanik ${num} Sibuk` : `Mekanik ${num} Ready`}</span>
               </div>
             ))}
          </div>

          <div className="grid gap-4">
            {queue.length === 0 && <p className="text-center text-slate-500 py-10">Belum ada antrian.</p>}
            {queue.map((item) => (
              <div key={item.id} className={`relative bg-slate-800 p-5 rounded-lg border-l-4 shadow-lg transition ${
                item.status === 'done' ? 'border-emerald-500 opacity-60' : 
                item.status === 'processing' ? 'border-blue-500 bg-slate-800/80 ring-1 ring-blue-500/50' : 
                item.status === 'pending' ? 'border-amber-500 opacity-80' : 'border-slate-500'
              }`}>
                <div className="flex justify-between gap-6 items-start">
                  <div className="flex flex-col items-center justify-center bg-slate-900/50 p-3 rounded-lg border border-slate-700 min-w-[80px]">
                    <span className="text-xs text-slate-500 uppercase">Nomor</span>
                    <span className="text-3xl font-bold text-white tracking-tighter">A-{String(item.no_antrian || 0).padStart(3, '0')}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                      <User size={18} /> {item.costumer_name}
                      <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold ${
                        item.status === 'processing' ? 'bg-blue-600 text-white' : 
                        item.status === 'done' ? 'bg-emerald-600 text-white' : 
                        item.status === 'pending' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300'
                      }`}>{item.status}</span>
                    </h3>
                    <p className="text-slate-400 mt-1 text-sm">{item.issue}</p>
                    <div className="mt-3 flex items-center gap-4 text-xs text-slate-500 bg-slate-900/30 p-2 rounded w-fit">
                        <span className="text-emerald-400 font-semibold flex items-center gap-1"><Bot size={14}/> {item.ai_analysis}</span>
                        <span className="text-amber-400 font-semibold flex items-center gap-1 border-l border-slate-600 pl-3"><Clock size={14}/> ± {item.estimated_mins} Mins</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- KOMPONEN HALAMAN LOGIN ---

function LoginSection({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
    } else {
      onNavigate('admin');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-mono">
      <div className="bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700 w-full max-w-md">
        <button 
          onClick={() => onNavigate('user')}
          className="text-slate-400 hover:text-white flex items-center gap-1 text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Kembali ke Papan Antrian
        </button>
        <div className="text-center mb-8">
          <div className="bg-red-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400 ring-2 ring-red-900">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Access</h1>
          <p className="text-slate-500 text-sm mt-2">Hanya untuk staff bengkel</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Email Staff</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white focus:border-red-500 outline-none transition-colors" 
              placeholder="admin@bengkel.com" 
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white focus:border-red-500 outline-none transition-colors" 
              placeholder="••••••••" 
            />
          </div>
          <button disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded flex justify-center items-center transition-colors">
            {loading ? <Loader2 className="animate-spin" /> : 'Masuk Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- KOMPONEN HALAMAN REKAP (HISTORY) ---

function RecapPage({ onNavigate }) {
  const [dataDone, setDataDone] = useState([]);
  const [dataPending, setDataPending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    if (!supabase) return;
    setLoading(true);
    const today = getTodayDate();
    
    // Ambil semua data SEBELUM hari ini
    const { data } = await supabase
      .from('Antrian')
      .select('*')
      .lt('created_at', today) 
      .order('created_at', { ascending: false });

    if (data) {
      setDataDone(data.filter(i => i.status === 'done'));
      setDataPending(data.filter(i => i.status === 'pending' || i.status === 'processing' || i.status === 'waiting'));
    }
    setLoading(false);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-mono">
      <div className="max-w-5xl mx-auto mb-8 flex flex-col sm:flex-row justify-between items-center border-b border-slate-700 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-cyan-500"><History size={32} /> Rekapitulasi</h1>
          <p className="text-slate-500 text-sm mt-1">Data pekerjaan hari-hari sebelumnya</p>
        </div>
        <button 
          onClick={() => onNavigate('admin')}
          className="px-4 py-2 text-slate-400 hover:text-white border border-slate-700 rounded-lg flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft size={16}/> Kembali ke Admin
        </button>
      </div>

      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
        {/* Kolom PENDING (Belum Selesai dari Kemarin) */}
        <div className="bg-slate-800/50 p-6 rounded-xl border border-amber-900/30">
           <h2 className="text-xl font-bold text-amber-500 mb-4 flex items-center gap-2">
             <PauseCircle size={20}/> Masih Pending / Belum Selesai
           </h2>
           {loading ? <Loader2 className="animate-spin text-slate-500"/> : dataPending.length === 0 ? <p className="text-slate-500 text-sm italic">Tidak ada pekerjaan tertunda.</p> : (
             <div className="space-y-3">
               {dataPending.map(item => (
                 <div key={item.id} className="bg-slate-800 p-3 rounded border border-amber-500/30 text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-white">{item.costumer_name}</span>
                      <span className="text-xs bg-amber-900 text-amber-200 px-1.5 py-0.5 rounded">{formatDate(item.created_at)}</span>
                    </div>
                    <p className="text-slate-400 text-xs mb-2">{item.issue}</p>
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>Status Terakhir: <strong className="uppercase text-amber-400">{item.status}</strong></span>
                      <span>No: A-{String(item.no_antrian).padStart(3,'0')}</span>
                    </div>
                 </div>
               ))}
             </div>
           )}
        </div>

        {/* Kolom SELESAI (Arsip) */}
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
           <h2 className="text-xl font-bold text-emerald-500 mb-4 flex items-center gap-2">
             <CheckCircle size={20}/> Riwayat Selesai
           </h2>
           {loading ? <Loader2 className="animate-spin text-slate-500"/> : dataDone.length === 0 ? <p className="text-slate-500 text-sm italic">Belum ada riwayat selesai.</p> : (
             <div className="space-y-3 h-[500px] overflow-y-auto pr-2 custom-scrollbar">
               {dataDone.map(item => (
                 <div key={item.id} className="bg-slate-800 p-3 rounded border border-slate-700 text-sm opacity-75 hover:opacity-100 transition">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-slate-300">{item.costumer_name}</span>
                      <span className="text-xs text-slate-500">{formatDate(item.created_at)}</span>
                    </div>
                    <p className="text-slate-500 text-xs">{item.issue}</p>
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );
}

// --- KOMPONEN HALAMAN ADMIN ---

function AdminPage({ onNavigate }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    if (!supabase) return;
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (!session) onNavigate('login');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) onNavigate('login');
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [onNavigate]);

  useEffect(() => {
    if (session && supabase) {
        fetchQueue();
        const channel = supabase
          .channel('realtime-queue-admin')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'Antrian' }, () => {
            fetchQueue();
            setTimeout(() => checkAndFillSlots(), 1000);
          })
          .subscribe();
        return () => {
          if (supabase) supabase.removeChannel(channel);
        };
    }
  }, [session]);

  const fetchQueue = async () => {
    if (!supabase) return;
    const today = getTodayDate();
    // Filter: Hanya tampilkan antrian HARI INI
    const { data } = await supabase
      .from('Antrian')
      .select('*')
      .gte('created_at', today)
      .order('created_at', { ascending: true });
    if (data) setQueue(data);
  };

  const handleAdminAction = async (id, action) => {
    if (!supabase) return;
    const newStatus = action === 'resume' ? 'waiting' : action;
    await supabase.from('Antrian').update({ status: newStatus }).eq('id', id);
    if (action === 'done') {
        setTimeout(() => checkAndFillSlots(), 500);
    }
  };

  const deleteQueue = async (id) => {
    if (!supabase) return;
    if (confirm("Hapus data antrian ini secara permanen?")) {
        await supabase.from('Antrian').delete().eq('id', id);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    onNavigate('user');
  };

  // Hitung jumlah mekanik yang sedang bekerja
  const activeMechanics = queue.filter(q => q.status === 'processing').length;

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;
  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 font-mono">
      <div className="max-w-5xl mx-auto mb-8 flex flex-col sm:flex-row justify-between items-center border-b border-slate-700 pb-6 gap-4">
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-bold flex items-center justify-center sm:justify-start gap-3 text-red-500"><Bot size={32} /> Admin Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
             Hari ini: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2 sm:gap-4 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
            <button 
              onClick={() => onNavigate('recap')}
              className="px-4 py-2 bg-slate-800 text-cyan-400 hover:text-cyan-300 border border-slate-700 rounded-lg flex items-center gap-2 text-sm transition-colors"
            >
              <FileText size={16}/> <span className="hidden sm:inline">Lihat Rekap</span><span className="sm:hidden">Rekap</span>
            </button>
            <button 
              onClick={() => onNavigate('user')}
              className="px-4 py-2 text-slate-400 hover:text-white border border-slate-700 rounded-lg flex items-center gap-2 text-sm transition-colors"
            >
              <ArrowLeft size={16}/> <span className="hidden sm:inline">Ke Halaman User</span><span className="sm:hidden">User</span>
            </button>
            <button onClick={handleLogout} className="px-4 py-2 bg-red-900/30 text-red-400 hover:bg-red-900 border border-red-900 rounded-lg flex items-center gap-2 text-sm transition-colors">
              <LogOut size={16} /> Logout
            </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto">
        {/* Status Mekanik untuk Admin */}
        <div className="grid grid-cols-2 gap-4 mb-6">
             {[1, 2].map(num => (
               <div key={num} className={`p-3 rounded border flex items-center gap-3 transition-colors ${activeMechanics >= num ? 'bg-blue-900/20 border-blue-500' : 'bg-slate-800 border-slate-700 opacity-50'}`}>
                 <Wrench size={20} className={activeMechanics >= num ? "text-blue-400" : "text-slate-500"} />
                 <span className="text-sm font-bold">{activeMechanics >= num ? `Mekanik ${num} Sibuk` : `Mekanik ${num} Ready`}</span>
               </div>
             ))}
        </div>

        <div className="grid gap-4">
            {queue.length === 0 && <p className="text-slate-500 text-center py-10 border border-slate-800 rounded bg-slate-800/30">Tidak ada antrian aktif hari ini.</p>}
            {queue.map((item) => (
              <div key={item.id} className={`relative bg-slate-800 p-5 rounded-lg border-l-4 shadow-lg ${
                item.status === 'done' ? 'border-emerald-500 opacity-60' : 
                item.status === 'processing' ? 'border-blue-500 bg-slate-800/80 ring-1 ring-blue-500/50' : 
                item.status === 'pending' ? 'border-amber-500 opacity-80' : 'border-slate-500'
              }`}>
                {/* Responsive Flex Container */}
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
                  
                  {/* Number Box: Row on mobile, Col on desktop */}
                  <div className="flex flex-row sm:flex-col items-center justify-between sm:justify-center bg-slate-900/50 p-3 rounded-lg border border-slate-700 w-full sm:w-auto sm:min-w-[80px]">
                    <span className="text-xs text-slate-500 uppercase">Nomor</span>
                    <span className="text-3xl font-bold text-white tracking-tighter">A-{String(item.no_antrian || 0).padStart(3, '0')}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 w-full">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                      <User size={18} /> {item.costumer_name}
                      <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold ${
                        item.status === 'processing' ? 'bg-blue-600 text-white' : 
                        item.status === 'done' ? 'bg-emerald-600 text-white' : 
                        item.status === 'pending' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300'
                      }`}>{item.status}</span>
                    </h3>
                    <p className="text-slate-400 mt-1 text-sm">{item.issue}</p>
                    <div className="mt-3 flex items-center gap-4 text-xs text-slate-500 bg-slate-900/30 p-2 rounded w-fit">
                        <span className="text-emerald-400 font-semibold flex items-center gap-1"><Bot size={14}/> {item.ai_analysis}</span>
                        <span className="text-amber-400 font-semibold flex items-center gap-1 border-l border-slate-600 pl-3"><Clock size={14}/> ± {item.estimated_mins} Mins</span>
                    </div>
                  </div>

                  {/* Actions: Full width on mobile, Side col on desktop */}
                  <div className="flex flex-col gap-2 w-full sm:w-auto sm:pl-4 sm:border-l border-slate-700 sm:min-w-[140px] pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-700">
                        {item.status === 'processing' && (
                          <>
                            <button onClick={() => handleAdminAction(item.id, 'done')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded flex items-center justify-center gap-2 text-xs font-bold shadow-lg w-full transition-colors">
                              <CheckCircle size={16}/> SELESAI
                            </button>
                            <button onClick={() => handleAdminAction(item.id, 'pending')} className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded flex items-center justify-center gap-2 text-xs font-bold shadow-lg w-full transition-colors">
                              <PauseCircle size={16}/> PENDING
                            </button>
                          </>
                        )}
                        {item.status === 'pending' && (
                          <button onClick={() => handleAdminAction(item.id, 'resume')} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded flex items-center justify-center gap-2 text-xs font-bold shadow-lg animate-pulse w-full transition-colors">
                            <Play size={16}/> RESUME
                          </button>
                        )}
                        {(item.status === 'waiting' || item.status === 'done') && (
                          <button onClick={() => deleteQueue(item.id)} className="bg-red-900/20 hover:bg-red-900 text-red-400 p-2 rounded flex justify-center w-full transition-colors" title="Hapus Data">
                            <Trash2 size={18}/>
                          </button>
                        )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// --- MAIN APP (State Based Navigation + Script Loader) ---

export default function App() {
  const [currentView, setCurrentView] = useState('user'); // 'user', 'login', 'admin', 'recap'
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);

  useEffect(() => {
    // Inject Script Supabase
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.46.1/dist/umd/supabase.min.js';
    script.async = true;
    script.onload = () => {
      // Initialize Supabase Client globally
      // Cek apakah variabel sudah diisi (tidak kosong)
      if (window.supabase && SUPABASE_URL && SUPABASE_KEY) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      }
      setIsSupabaseReady(true);
    };
    script.onerror = () => {
      console.error("Gagal memuat Supabase script");
      setIsSupabaseReady(true); // Tetap render UI walau gagal, nanti ada pesan error
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup is hard with global scripts, usually fine to leave it.
    };
  }, []);

  if (!isSupabaseReady) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4 font-mono">
        <Loader2 className="animate-spin" size={48} />
        <p className="animate-pulse">Menghubungkan ke System...</p>
      </div>
    );
  }

  // Warning jika config belum diisi
  if (!supabase) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white text-center font-mono">
        <div className="max-w-md border border-red-500 bg-red-900/20 p-6 rounded-lg">
          <h2 className="text-xl font-bold text-red-400 mb-2">Konfigurasi Diperlukan</h2>
          <p className="text-sm text-slate-300 mb-4">
            Aplikasi tidak dapat berjalan karena URL/Key Supabase belum ditemukan.
          </p>
          <div className="bg-slate-950 p-4 rounded text-left overflow-x-auto mb-4">
             <p className="text-xs text-emerald-400 mb-2">// 1. Di Komputer Lokal (Recommended):</p>
             <p className="text-xs text-slate-400">Buat file <code>.env</code> dan isi <code>VITE_SUPABASE_URL</code> dsb.</p>
             <br/>
             <p className="text-xs text-emerald-400 mb-2">// 2. Di Preview ini (Testing):</p>
             <p className="text-xs text-slate-400">Edit kode dan ganti string kosong pada <code>SUPABASE_URL</code> di baris 24 dengan URL asli Anda.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {currentView === 'user' && <UserPage onNavigate={setCurrentView} />}
      {currentView === 'login' && <LoginSection onNavigate={setCurrentView} />}
      {currentView === 'admin' && <AdminPage onNavigate={setCurrentView} />}
      {currentView === 'recap' && <RecapPage onNavigate={setCurrentView} />}
    </>
  );
}