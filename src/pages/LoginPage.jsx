import React, { useState } from 'react';
import { Loader2, ArrowLeft, Lock } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function LoginPage({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else onNavigate('admin');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-mono">
      <div className="bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700 w-full max-w-md">
        <button onClick={() => onNavigate('user')} className="text-slate-400 hover:text-white flex items-center gap-1 text-sm mb-6 transition">
          <ArrowLeft size={16} /> Kembali ke Papan Antrian
        </button>
        <div className="text-center mb-8">
          <div className="bg-red-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400 ring-2 ring-red-900">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Access</h1>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white focus:border-red-500 outline-none" placeholder="admin@bengkel.com" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white focus:border-red-500 outline-none" placeholder="••••••••" />
          <button disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded flex justify-center items-center">
            {loading ? <Loader2 className="animate-spin" /> : 'Masuk Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}