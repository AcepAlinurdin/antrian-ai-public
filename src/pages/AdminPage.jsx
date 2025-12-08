import React, { useState, useEffect } from 'react';
import { Loader2, Bot, LogOut, FileText, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getTodayDate, formatDate, checkAndFillSlots } from '../lib/utils';
import MechanicStatus from '../components/MechanicStatus';
import TicketCard from '../components/TicketCard';
import PageHeader from '../components/PageHeader';

export default function AdminPage({ onNavigate }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) onNavigate('login');
      else setLoading(false);
    });

    const fetchQueue = async () => {
      const today = getTodayDate();
      const { data } = await supabase.from('Antrian').select('*').gte('created_at', today).order('created_at', { ascending: true });
      if (data) setQueue(data);
    };

    fetchQueue();
    const channel = supabase.channel('realtime-queue-admin').on('postgres_changes', { event: '*', schema: 'public', table: 'Antrian' }, () => {
      fetchQueue(); setTimeout(checkAndFillSlots, 1000);
    }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [onNavigate]);

  const handleAction = async (id, action) => {
    const newStatus = action === 'resume' ? 'waiting' : action;
    await supabase.from('Antrian').update({ status: newStatus }).eq('id', id);
    if (action === 'done') setTimeout(checkAndFillSlots, 500);
  };

  const handleDelete = async (id) => {
    if (confirm("Hapus permanen?")) await supabase.from('Antrian').delete().eq('id', id);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onNavigate('user');
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex justify-center items-center text-white"><Loader2 className="animate-spin"/></div>;

  const activeMechanics = queue.filter(q => q.status === 'processing').length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 font-mono">
      <PageHeader 
        title="Admin Dashboard" 
        subtitle={`Hari ini: ${formatDate(new Date())}`}
        icon={Bot}
        actions={
          <>
          <button onClick={() => onNavigate('inventory')} className="px-4 py-2 bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900 border border-emerald-900 rounded-lg flex items-center gap-2 text-sm transition">
      <Package size={16}/> Gudang & Stok
    </button>
            <button onClick={() => onNavigate('recap')} className="px-4 py-2 bg-slate-800 hover:text-cyan-300 border border-slate-700 rounded-lg flex items-center gap-2 text-sm transition">
              <FileText size={16}/> <span className="hidden sm:inline">Rekap</span>
            </button>
            <button onClick={() => onNavigate('user')} className="px-4 py-2 hover:text-white border border-slate-700 rounded-lg flex items-center gap-2 text-sm transition">
              <ArrowLeft size={16}/> <span className="hidden sm:inline">User View</span>
            </button>
            <button onClick={handleLogout} className="px-4 py-2 bg-red-900/30 text-red-400 hover:bg-red-900 border border-red-900 rounded-lg flex items-center gap-2 text-sm transition">
              <LogOut size={16} /> Logout
            </button>
          </>
        }
      />
      <div className="max-w-5xl mx-auto">
        <MechanicStatus activeMechanics={activeMechanics} />
        <div className="grid gap-4">
          {queue.length === 0 && <p className="text-slate-500 text-center py-10 bg-slate-800/30 rounded">Tidak ada antrian aktif.</p>}
          {queue.map((item) => (
            <TicketCard key={item.id} item={item} isAdmin={true} onAction={handleAction} onDelete={handleDelete} />
          ))}
        </div>
      </div>
    </div>
  );
}