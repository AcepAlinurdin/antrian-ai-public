import { supabase } from './supabaseClient';

export const MAX_MECHANICS = 2;

export const getTodayDate = () => new Date().toISOString().split('T')[0];

export const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('id-ID', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });
};

// Logika Auto-fill slot mekanik
export const checkAndFillSlots = async () => {
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