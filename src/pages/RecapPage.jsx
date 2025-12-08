import React, { useState, useEffect } from 'react';
import { Loader2, PauseCircle, CheckCircle, ArrowLeft, History } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getTodayDate, formatDate } from '../lib/utils';
import PageHeader from '../components/PageHeader';

export default function RecapPage({ onNavigate }) {
  const [dataDone, setDataDone] = useState([]);
  const [dataPending, setDataPending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const today = getTodayDate();
      const { data } = await supabase.from('Antrian').select('*').lt('created_at', today).order('created_at', { ascending: false });
      if (data) {
        setDataDone(data.filter(i => i.status === 'done'));
        setDataPending(data.filter(i => i.status !== 'done'));
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const HistoryItem = ({ item }) => (
    <div className="bg-slate-800 p-3 rounded border border-slate-700 text-sm opacity-90 hover:opacity-100 transition">
      <div className="flex justify-between items-start mb-1">
        <span className="font-bold text-slate-300">{item.costumer_name}</span>
        <span className="text-xs text-slate-500">{formatDate(item.created_at)}</span>
      </div>
      <p className="text-slate-500 text-xs mb-2">{item.issue}</p>
      <div className="flex justify-between items-center text-xs">
        <span className={`uppercase font-bold ${item.status === 'done' ? 'text-emerald-500' : 'text-amber-500'}`}>{item.status}</span>
        <span>A-{String(item.no_antrian).padStart(3,'0')}</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-mono">
      <PageHeader 
        title="Rekapitulasi" 
        subtitle="Data pekerjaan hari-hari sebelumnya"
        icon={History}
        actions={
          <button onClick={() => onNavigate('admin')} className="px-4 py-2 text-slate-400 hover:text-white border border-slate-700 rounded-lg flex items-center gap-2 text-sm transition">
            <ArrowLeft size={16}/> Kembali ke Admin
          </button>
        }
      />
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
        <div className="bg-slate-800/50 p-6 rounded-xl border border-amber-900/30">
          <h2 className="text-xl font-bold text-amber-500 mb-4 flex items-center gap-2"><PauseCircle size={20}/> Masih Pending</h2>
          {loading ? <Loader2 className="animate-spin text-slate-500"/> : dataPending.length === 0 ? <p className="text-slate-500 italic text-sm">Nihil.</p> : (
            <div className="space-y-3">{dataPending.map(item => <HistoryItem key={item.id} item={item} />)}</div>
          )}
        </div>
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
          <h2 className="text-xl font-bold text-emerald-500 mb-4 flex items-center gap-2"><CheckCircle size={20}/> Riwayat Selesai</h2>
          {loading ? <Loader2 className="animate-spin text-slate-500"/> : dataDone.length === 0 ? <p className="text-slate-500 italic text-sm">Nihil.</p> : (
            <div className="space-y-3 h-[500px] overflow-y-auto pr-2 custom-scrollbar">{dataDone.map(item => <HistoryItem key={item.id} item={item} />)}</div>
          )}
        </div>
      </div>
    </div>
  );
}