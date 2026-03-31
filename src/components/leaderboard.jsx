import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Trophy, CalendarClock, Loader2, Crown } from 'lucide-react';

export default function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [now, setNow] = useState(new Date());
  const [isTimeSynced, setIsTimeSynced] = useState(false); 

  const timeOffset = useRef(0);
  const currentDateStr = useRef("");

  // 🏆 XP & LEVEL LOGIC CALCULATOR
  const calculateStats = (totalSeconds) => {
    const hours = totalSeconds / 3600;
    const level = Math.floor(hours / 2) + 1; 
    const rawXp = Math.floor(hours * 99); 

    let rank = { name: 'Silver', color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200' };
    
    if (rawXp >= 24750) rank = { name: 'Grandmaster', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' };
    else if (rawXp >= 14850) rank = { name: 'Master', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' };
    else if (rawXp >= 7920) rank = { name: 'Diamond', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' };
    else if (rawXp >= 3960) rank = { name: 'Platinum', color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' };
    else if (rawXp >= 1485) rank = { name: 'Gold', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' };

    return { level, rank };
  };

  useEffect(() => {
    let isMounted = true;
    let clockTimer;

    const syncRealBangladeshTime = async () => {
      let offset = 0;
      try {
        const res1 = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=Asia/Dhaka');
        if (res1.ok) {
          const data = await res1.json();
          const realTime = new Date(data.dateTime + "+06:00").getTime();
          offset = realTime - new Date().getTime();
        } else throw new Error("API 1 Blocked");
      } catch (err1) {
        try {
          const res2 = await fetch('https://worldtimeapi.org/api/timezone/Asia/Dhaka');
          if (res2.ok) {
            const data2 = await res2.json();
            const realTime = new Date(data2.datetime).getTime();
            offset = realTime - new Date().getTime();
          }
        } catch (err2) { console.error("Using local PC time."); }
      }

      if (isMounted) {
        timeOffset.current = offset;
        setIsTimeSynced(true); 
        
        const exactNow = new Date(new Date().getTime() + offset);
        setNow(exactNow);
        
        const dateStr = exactNow.toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' });
        currentDateStr.current = dateStr;
        
        fetchLeaderboard(dateStr);
        
        clockTimer = setInterval(() => {
          setNow(new Date(new Date().getTime() + timeOffset.current));
        }, 1000);
      }
    };

    syncRealBangladeshTime();

    const channel = supabase.channel('public:daily_logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_logs' }, () => {
        if (currentDateStr.current) fetchLeaderboard(currentDateStr.current);
      }).subscribe();

    return () => {
      isMounted = false;
      if (clockTimer) clearInterval(clockTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLeaderboard = async (dateString) => {
    setLoading(true);
    const { data: todayData, error } = await supabase
      .from('daily_logs')
      .select('user_id, study_seconds, self_study_seconds, class_seconds, profiles(username)')
      .eq('date_str', dateString)
      .order('study_seconds', { ascending: false })
      .limit(50);
      
    if (todayData && !error) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: lbData } = await supabase
        .from('daily_logs')
        .select('user_id, study_seconds')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const userTotals = {};
      if (lbData) {
        lbData.forEach(log => {
          if (!userTotals[log.user_id]) userTotals[log.user_id] = 0;
          userTotals[log.user_id] += parseInt(log.study_seconds || 0, 10);
        });
      }

      const finalLeaders = todayData.map(user => {
        return { ...user, total_30d_seconds: userTotals[user.user_id] || parseInt(user.study_seconds || 0, 10) };
      });
      setLeaders(finalLeaders);
    }
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

  const formatName = (name) => name ? name.trim().split(' ')[0].charAt(0).toUpperCase() + name.trim().split(' ')[0].slice(1).toLowerCase() : "Scholar";

  const formattedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Dhaka' });
  const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Dhaka' });

  return (
    <div className="pt-6 font-sans text-slate-800 pb-24 px-3 relative">
      <style dangerouslySetInnerHTML={{__html: `.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}} />
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight flex items-center justify-center gap-2"><Trophy size={28} className="text-[#10a37f]" /> Daily Hall of Fame</h1>
          <p className="text-slate-500 font-medium mt-2.5 max-w-lg mx-auto text-sm sm:text-base leading-relaxed">Compete with peers, push your limits, and climb the ranks. <br className="hidden sm:block" /> The leaderboard resets every night at <span className="font-semibold text-slate-700">12:00 AM</span>.</p>
          <div className="inline-flex items-center gap-2 mt-5 bg-sky-50/60 border border-sky-100 px-4 py-2 rounded-full shadow-sm text-sm font-medium text-slate-600 transition-all">
            {isTimeSynced ? (<><CalendarClock size={16} className="text-[#10a37f]" /><span>Today {formattedDate} — {formattedTime}</span></>) : (<><Loader2 size={16} className="text-[#10a37f] animate-spin" /><span className="text-slate-400">Syncing live time...</span></>)}
          </div>
        </div>

        <div className="bg-sky-50/40 backdrop-blur-2xl border border-sky-100/60 shadow-sm rounded-3xl overflow-hidden flex flex-col">
          <div className="bg-white/50 flex items-center px-3 sm:px-5 py-3 font-bold text-[10px] sm:text-xs text-slate-500 uppercase tracking-widest border-b border-sky-100/60">
            <div className="w-8 sm:w-10 text-center flex-shrink-0 mr-3">Rank</div><div className="flex-1">Scholar Profile</div><div className="text-right flex-shrink-0">Total Focus</div>
          </div>
          <div className="p-2.5 sm:p-4 space-y-2.5 max-h-[65vh] overflow-y-auto no-scrollbar">
            {!isTimeSynced || loading ? (
                <div className="flex justify-center py-10"><span className="text-[#10a37f] font-semibold tracking-widest uppercase text-xs animate-pulse">Fetching Live Standings...</span></div>
            ) : leaders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 bg-white/60 rounded-[1.25rem] border border-dashed border-sky-200/60 h-full mx-1"><Trophy size={28} className="text-slate-300 mb-3" /><p className="text-xs font-semibold text-slate-400 tracking-wider uppercase">No focus sessions yet today.</p><p className="text-[11px] text-slate-400 mt-1 font-medium">Be the first to claim the #1 spot! 👑</p></div>
            ) : (
              leaders.map((user, index) => {
                const stats = calculateStats(user.total_30d_seconds);
                const isTop3 = index < 3;
                return (
                  <div key={index} className="relative bg-white border border-slate-100/80 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm flex items-center transition-all hover:border-[#10a37f]/30 hover:shadow-md group">
                    <div className={`w-8 sm:w-10 flex-shrink-0 text-center flex justify-center mr-3 ${isTop3 ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl font-bold text-slate-400'}`}>{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}</div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-1"><p className="font-bold text-slate-800 text-[14px] sm:text-[16px] truncate tracking-tight">{formatName(user.profiles?.username)}</p>
                        <div className="flex items-center gap-1.5 flex-shrink-0"><span className="text-[9px] sm:text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded leading-none">Lvl {stats.level}</span><span className={`hidden sm:inline-block text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded border leading-none ${stats.rank.bg} ${stats.rank.color} ${stats.rank.border}`}>{stats.rank.name}</span></div>
                      </div>
                      {(user.self_study_seconds > 0 || user.class_seconds > 0) && (
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          {user.self_study_seconds > 0 && (<span className="font-mono text-[9px] sm:text-[10px] font-semibold text-[#10a37f] bg-[#10a37f]/10 px-1.5 py-0.5 rounded tracking-tight">Self: {formatStudyTime(user.self_study_seconds)}</span>)}
                          {user.class_seconds > 0 && (<span className="font-mono text-[9px] sm:text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded tracking-tight">Class: {formatStudyTime(user.class_seconds)}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right ml-2"><div className="font-mono text-[12px] sm:text-[14px] tracking-tight tabular-nums font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-emerald-50/80 text-[#10a37f] border border-emerald-100 shadow-sm whitespace-nowrap">{formatStudyTime(user.study_seconds)}</div></div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}