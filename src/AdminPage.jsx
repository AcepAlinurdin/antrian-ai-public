import { useState, useEffect } from 'react';
import { supabase } from './lib/clients'; 
import { Loader2, Bot, User, Clock, CheckCircle, PauseCircle, Trash2, LogOut, Lock, Play, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const MAX_MECHANICS = 2;

export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchQueue();
    const channel = supabase
      .channel('realtime-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Antrian' }, () => {
        fetchQueue();
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
                for (let item of nextInLine) await supabase.from('Antrian').update({ status: 'processing' }).eq('id', item.id);
            }
        }
    } catch (err) { console.error(err); }
  };

  const handleAdminAction = async (id, action) => {
    const newStatus = action === 'resume' ? 'waiting' : action;
    await supabase.from('Antrian').update({ status: newStatus }).eq('id', id);
    setTimeout(() => checkAndFillSlots(), 500);
  };

  const deleteQueue = async (id) => {
    if (confirm("Hapus data ini?")) await supabase.from('Antrian').delete().eq('id', id);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;

  if (!session) {
    return <LoginSection />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-mono">
      <div className="max-w-5xl mx-auto mb-8 flex flex-col sm:flex-row justify-between items-center border-b border-slate-700 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-red-500"><Bot size={32} /> Admin</h1>
          <p className="text-slate-500 text-sm mt-1">Logged in as: {session.user.email}</p>
        </div>
        <div className="flex gap-4">
            <Link to="/" className="px-4 py-2 text-slate-400 hover:text-white border border-slate-700 rounded-lg flex items-center gap-2 text-sm"><ArrowLeft size={16}/> Ke Halaman User</Link>
            <button onClick={handleLogout} className="px-4 py-2 bg-red-900/30 text-red-400 hover:bg-red-900 border border-red-900 rounded-lg flex items-center gap-2 text-sm"><LogOut size={16} /> Logout</button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto">
        <div className="grid gap-4">
            {queue.map((item) => (
              <div key={item.id} className={`relative bg-slate-800 p-5 rounded-lg border-l-4 shadow-lg ${
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

                  <div className="flex flex-col gap-2 pl-4 border-l border-slate-700">
                       {item.status === 'processing' && (
                         <>
                           <button onClick={() => handleAdminAction(item.id, 'done')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded flex items-center gap-2 text-xs font-bold shadow-lg"><CheckCircle size={16}/> SELESAI</button>
                           <button onClick={() => handleAdminAction(item.id, 'pending')} className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded flex items-center gap-2 text-xs font-bold shadow-lg"><PauseCircle size={16}/> PENDING</button>
                         </>
                       )}
                       {item.status === 'pending' && (
                         <button onClick={() => handleAdminAction(item.id, 'resume')} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded flex items-center gap-2 text-xs font-bold shadow-lg animate-pulse"><Play size={16}/> RESUME</button>
                       )}
                       {item.status === 'waiting' && (
                         <button onClick={() => deleteQueue(item.id)} className="bg-red-900/20 hover:bg-red-900 text-red-400 p-2 rounded flex justify-center" title="Tolak / Hapus"><Trash2 size={18}/></button>
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

function LoginSection() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-mono">
      <div className="bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700 w-full max-w-md">
        <Link to="/" className="text-slate-400 hover:text-white flex items-center gap-1 text-sm mb-6"><ArrowLeft size={16} /> Kembali ke Papan Antrian</Link>
        <div className="text-center mb-8">
          <div className="bg-red-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400"><Lock size={32} /></div>
          <h1 className="text-2xl font-bold text-white">Admin</h1>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white focus:border-red-500 outline-none" placeholder="admin@test.com" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white focus:border-red-500 outline-none" placeholder="••••••••" />
          <button disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded flex justify-center items-center">{loading ? <Loader2 className="animate-spin" /> : 'Masuk Dashboard'}</button>
        </form>
      </div>
    </div>
  );
}