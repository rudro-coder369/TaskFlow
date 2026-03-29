import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Clock, CalendarDays, History as HistoryIcon, Sparkles } from 'lucide-react';

export default function History() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    // লজিক পারফেক্ট: created_at descending মানেই লেটেস্ট ডেট সবার আগে
    const { data, error } = await supabase
      .from('daily_logs')
      .select('date_str, study_seconds')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(30);
      
    if (data && !error) setLogs(data);
    setLoading(false);
  };

  const formatStudyTime = (totalSeconds) => {
    const validSeconds = parseInt(totalSeconds, 10);
    if (isNaN(validSeconds) || validSeconds <= 0) return "0s";
    const h = Math.floor(validSeconds / 3600);
    const m = Math.floor((validSeconds % 3600) / 60);
    const s = validSeconds % 60;
    
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  // 💎 100% PURE SKY BLUE GLASSMORPHISM (Matching Dashboard & TimerScreen)
  const skyGlassCard = "bg-sky-50/70 backdrop-blur-2xl border border-sky-100/80 shadow-[0_8px_32px_0_rgba(224,242,254,0.6)] rounded-[1.5rem] p-5 transition-all duration-300";

  return (
    <div className="pt-6 font-sans text-slate-800 pb-24 px-3">
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
        
        {/* HEADER SECTION (Matching Dashboard Style) */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-sky-100/60 pb-5 px-1">
          <div>
            <span className="text-slate-400 font-bold tracking-widest text-[10px] sm:text-xs mb-1.5 uppercase flex items-center gap-1.5">
              <Sparkles size={12} className="text-[#10a37f]" /> 30-Day Archive
            </span>
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-slate-800">Study History.</h1>
          </div>
        </div>

        {/* 📚 HISTORY LIST */}
        <div className={skyGlassCard}>
          <div className="flex items-center justify-between mb-5 border-b border-sky-100/50 pb-4">
             <div className="flex items-center gap-2.5">
               <HistoryIcon size={18} className="text-sky-500" strokeWidth={2.5} />
               <span className="text-[14px] font-bold text-slate-800 tracking-tight uppercase">Recent Sessions</span>
             </div>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/60 px-3 py-1 rounded-full border border-sky-100">
               {logs.length} Days Logged
             </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <span className="text-[#10a37f] font-bold tracking-widest uppercase text-xs animate-pulse">Fetching Records...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 bg-white/40 rounded-[1.25rem] border border-dashed border-sky-200/60 h-full">
              <Clock size={24} className="text-slate-300 mb-3" />
              <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">No study sessions logged yet.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
              {logs.map((log, index) => (
                <div key={index} className="bg-white/80 backdrop-blur-md border border-sky-100 hover:border-[#10a37f]/30 p-4 rounded-[1.25rem] shadow-sm hover:shadow-md transition-all duration-300 flex justify-between items-center group">
                  
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-sky-50 rounded-full flex items-center justify-center text-sky-600 border border-sky-100 shadow-inner group-hover:bg-[#10a37f]/10 group-hover:text-[#10a37f] transition-colors">
                      <CalendarDays size={18} strokeWidth={2.5} />
                    </div>
                    <span className="text-[15px] font-semibold text-slate-800 tracking-tight">
                      {log.date_str}
                    </span>
                  </div>
                  
                  <div className="font-mono text-[14px] tracking-tight tabular-nums font-bold px-3 py-1.5 rounded-lg bg-sky-50/50 text-sky-600 border border-sky-100 group-hover:bg-[#10a37f]/10 group-hover:text-[#10a37f] group-hover:border-[#10a37f]/20 transition-colors">
                    {formatStudyTime(log.study_seconds)}
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}