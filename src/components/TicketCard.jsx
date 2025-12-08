import React from 'react';
import { User, Bot, Clock, CheckCircle, PauseCircle, Play, Trash2 } from 'lucide-react';

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

        {/* Admin Actions */}
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

export default TicketCard;