import React, { useState, useEffect } from 'react';
import { Loader2, Bot, LogIn, Wrench, User, Clock, CheckCircle, PauseCircle, Play, Trash2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// ==========================================
// 1. INLINE HELPERS & CONFIG (Supabase & Utils)
// ==========================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MAX_MECHANICS = 2;

const getTodayDate = () => new Date().toISOString().split('T')[0];

const checkAndFillSlots = async () => {
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

      if (nextInLine?.length > 0) {
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
// 2. INLINE COMPONENTS (UI)
// ==========================================

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

const TicketCard = ({ item }) => {
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
        {/* Nomor Antrian */}
        <div className="flex flex-row sm:flex-col items-center justify-between sm:justify-center bg-slate-900/50 p-3 rounded-lg border border-slate-700 w-full sm:w-auto sm:min-w-[80px]">
          <span className="text-xs text-slate-500 uppercase">Nomor</span>
          <span className="text-3xl font-bold text-white tracking-tighter">A-{String(item.no_antrian || 0).padStart(3, '0')}</span>
        </div>

        {/* Detail */}
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
      </div>
    </div>
  );
};

// ==========================================
// 3. MAIN USER PAGE COMPONENT
// ==========================================

export default function UserPage({ onNavigate }) {
  const [name, setName] = useState('');
  const [issue, setIssue] = useState('');
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState([]);

  const activeMechanics = queue.filter(q => q.status === 'processing').length;

  // --- Realtime Subscription ---
  useEffect(() => {
    const fetchQueue = async () => {
      const today = getTodayDate();
      const { data } = await supabase
        .from('Antrian')
        .select('*')
        .gte('created_at', today)
        .order('created_at', { ascending: true });
        
      if (data) setQueue(data);
    };

    fetchQueue();

    // Subscribe ke perubahan data di Supabase (Realtime)
    const channel = supabase.channel('realtime-queue-user')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Antrian' }, () => {
        fetchQueue();
        setTimeout(checkAndFillSlots, 1000); // Cek slot kosong otomatis
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, []);

  // --- Handle Submit Antrian ---
  const handleJoinQueue = async (e) => {
    e.preventDefault();
    if (!name || !issue) return;
    setLoading(true);

    try {
      const today = getTodayDate();
      
      // Ambil nomor antrian terakhir hari ini
      const { count } = await supabase
        .from('Antrian')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);
        
      const nextNumber = (count || 0) + 1;
      
      let aiSummary = "Menunggu Analisa";
      let estMins = 30;
      let isValid = false;

      // 1. Panggil Backend Serverless (/api/chat) untuk Analisa AI
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ issue }),
        });

        if (!response.ok) throw new Error('Backend Failed');

        const aiData = await response.json();
        
        if (aiData) {
          isValid = aiData.valid;
          aiSummary = aiData.summary;
          estMins = aiData.mins || 30;
        }
      } catch (err) {
        console.warn("Backend Error, Fallback Manual:", err);
        // Fallback Manual jika server backend error/sibuk (atau di environment preview)
        const keywords = ['rem','ban','oli','mesin','servis','lampu','busi','aki','karbu','cvt','kampas','rantai','bensin','stater','starter','gas','spion','jok'];
        isValid = keywords.some(w => issue.toLowerCase().includes(w));
        aiSummary = isValid ? "Validasi Manual (Server Sibuk)" : "Gunakan kata kunci motor";
      }

      // 2. Validasi Hasil
      if (!isValid) {
        alert(`❌ Ditolak: ${aiSummary}\n\nMohon jelaskan kerusakan motor dengan lebih spesifik.`);
        setLoading(false); 
        return;
      }

      // 3. Simpan ke Supabase
      const { error } = await supabase.from('Antrian').insert([{
        costumer_name: name, 
        issue: issue, 
        ai_analysis: aiSummary, 
        estimated_mins: estMins, 
        status: 'waiting', 
        no_antrian: nextNumber
      }]);

      if (error) throw error;
      
      // Reset Form
      setName(''); 
      setIssue('');
      alert(`✅ Berhasil! Nomor Antrian: A-${nextNumber}`);
      
      // Cek apakah bisa langsung diproses
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
      {/* Header */}
      <PageHeader 
        title="System Antrian AI" 
        subtitle="Selamat Datang, Silahkan Ambil Nomor." 
        icon={Bot}
        actions={
          <button 
            onClick={() => onNavigate('login')} 
            className="px-4 py-2 bg-slate-800 hover:text-cyan-400 rounded-lg text-sm border border-slate-700 flex items-center gap-2 transition"
          >
            <LogIn size={16} /> Staff Login
          </button>
        }
      />

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* Kolom Kiri: Form Input */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 sticky top-6">
            <h2 className="text-xl font-bold mb-4 text-emerald-400">Ambil Nomor</h2>
            <form onSubmit={handleJoinQueue} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Nama Pelanggan</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-600 rounded p-3 focus:border-emerald-500 outline-none text-white transition-colors" 
                  placeholder="Nama Kamu" 
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Keluhan Motor</label>
                <textarea 
                  value={issue} 
                  onChange={e => setIssue(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-600 rounded p-3 focus:border-emerald-500 outline-none h-32 text-white resize-none transition-colors" 
                  placeholder="Contoh: Rem belakang bunyi, Ganti Oli Mesin..." 
                />
              </div>
              <button 
                disabled={loading} 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded flex justify-center items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Ambil Antrian'}
              </button>
            </form>
          </div>
        </div>

        {/* Kolom Kanan: Daftar Antrian */}
        <div className="lg:col-span-2">
          <MechanicStatus activeMechanics={activeMechanics} />
          
          <div className="grid gap-4">
            {queue.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-lg">
                <p className="text-slate-500">Belum ada antrian hari ini.</p>
                <p className="text-slate-600 text-sm mt-1">Jadilah yang pertama!</p>
              </div>
            )}
            
            {queue.map((item) => (
              <TicketCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}