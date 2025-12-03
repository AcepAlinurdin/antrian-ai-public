import { useState, useEffect } from 'react';
import { supabase } from './lib/clients'; // Import dari file clients.js
import { Loader2, Bot, User, Clock, Wrench, LogIn } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Link } from 'react-router-dom';

const MAX_MECHANICS = 2;

export default function UserPage() {
  const [name, setName] = useState('');
  const [issue, setIssue] = useState('');
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState([]);

  // Hitung mekanik aktif untuk display
  const activeMechanics = queue.filter(q => q.status === 'processing').length;

  useEffect(() => {
    fetchQueue();
    // Realtime Listener
    const channel = supabase
      .channel('realtime-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Antrian' }, () => {
        fetchQueue();
        // User juga bisa memicu auto-refill saat daftar
        setTimeout(() => checkAndFillSlots(), 1000);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const fetchQueue = async () => {
    const { data } = await supabase.from('Antrian').select('*').order('created_at', { ascending: true });
    if (data) setQueue(data);
  };


  const checkAndFillSlots = async () => {
    try {
        const { count: processingCount } = await supabase.from('Antrian').select('*', { count: 'exact', head: true }).eq('status', 'processing');
        if ((processingCount || 0) < MAX_MECHANICS) {
            const slotsAvailable = MAX_MECHANICS - (processingCount || 0);
            const { data: nextInLine } = await supabase.from('Antrian').select('*').eq('status', 'waiting').order('created_at', { ascending: true }).limit(slotsAvailable);
            if (nextInLine && nextInLine.length > 0) {
                for (let item of nextInLine) {
                    await supabase.from('Antrian').update({ status: 'processing' }).eq('id', item.id);
                }
            }
        }
    } catch (err) { console.error(err); }
  };

  const handleJoinQueue = async (e) => {
    e.preventDefault();
    if (!name || !issue) return;
    setLoading(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase.from('Antrian').select('*', { count: 'exact', head: true }).gte('created_at', today);
      const nextNumber = (count || 0) + 1;

      const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `Role: Admin Bengkel. Keluhan: "${issue}". Validasi: Masalah motor? JSON: {"valid": boolean, "summary": "Singkat", "mins": number}`;
      
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json|```/g, '').trim();
      const aiData = JSON.parse(text);

      if (aiData.valid === false) {
        alert(`Ditolak AI: ${aiData.summary}`);
        setLoading(false); return;
      }

      const { error } = await supabase.from('Antrian').insert([{
        costumer_name: name, issue: issue, ai_analysis: aiData.summary, estimated_mins: aiData.mins, 
        status: 'waiting', no_antrian: nextNumber
      }]);

      if (error) throw error;
      setName(''); setIssue('');
      alert(`Berhasil! Nomor Antrian: A-${nextNumber}`);
      
      setTimeout(checkAndFillSlots, 500);

    } catch (error) { console.error(error); alert("Gagal/Error: Cek Konsole"); } 
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-mono">
      <div className="max-w-6xl mx-auto mb-8 flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-slate-700 pb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-cyan-400"><Bot size={32} /> System Antrian berbasis AI</h1>
          <p className="text-slate-500 text-sm mt-1">Selamat Datang, Silahkan Ambil Nomor.</p>
        </div>
        <Link to="/admin" className="px-4 py-2 bg-slate-800 hover:text-cyan-400 rounded-lg text-sm border border-slate-700 flex items-center gap-2 transition">
          <LogIn size={16} /> Staff Login
        </Link>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10">
    
        <div className="lg:col-span-1">
          <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700 sticky top-6">
            <h2 className="text-xl font-bold mb-4 text-emerald-400">Ambil Nomor</h2>
            <form onSubmit={handleJoinQueue} className="space-y-4">
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-emerald-500 outline-none" placeholder="Nama Kamu" />
              <textarea value={issue} onChange={e => setIssue(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-emerald-500 outline-none h-32" placeholder="Keluhan Motor..." />
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
                        item.status === 'processing' ? 'bg-blue-600 text-white animate-pulse' : 
                        item.status === 'done' ? 'bg-emerald-600 text-white' : 
                        item.status === 'pending' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {item.status === 'processing' ? 'DIKERJAKAN' : item.status === 'pending' ? 'PENDING (PART)' : item.status}
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}