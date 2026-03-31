import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Trophy, CalendarClock, Loader2 } from 'lucide-react';

export default function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [now, setNow] = useState(new Date());
  const [isTimeSynced, setIsTimeSynced] = useState(false); 

  const timeOffset = useRef(0);
  const currentDateStr = useRef("");

  // 🏆 XP & LEVEL LOGIC CALCULATOR (No UI changes, just logic)
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
        } else {
          throw new Error("API 1 Blocked");
        }
      } catch (err1) {
        try {
          const res2 = await fetch('https://worldtimeapi.org/api/timezone/Asia/Dhaka');
          if (res2.ok) {
            const data2 = await res2.json();
            const realTime = new Date(data2.datetime).getTime();
            offset = realTime - new Date().getTime();
          }
        } catch (err2) {
          console.error("Both Time APIs blocked by browser. Using local PC time.", err2);
        }
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
        if (currentDateStr.current) {
          fetchLeaderboard(currentDateStr.current);
        }
      }).subscribe();

    return () => {
      isMounted = false;
      if (clockTimer) clearInterval(clockTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLeaderboard = async (dateString) => {
    setLoading(true);
    
    // ১. আজকে যারা পড়েছে তাদের লিস্ট নেওয়া
    const { data: todayData, error } = await supabase
      .from('daily_logs')
      .select('user_id, study_seconds, profiles(username)')
      .eq('date_str', dateString)
      .order('study_seconds', { ascending: false })
      .limit(50);
      
    if (todayData && !error) {
      // ২. গত ৩০ দিনের ডেটা নিয়ে আসা (সবার রিয়েল লেভেল হিসাব করার জন্য)
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

      // ৩. আজকের লিডারবোর্ডের সাথে লেভেল ডেটা মার্জ করা
      const finalLeaders = todayData.map(user => {
        const totalSecs = userTotals[user.user_id] || parseInt(user.study_seconds || 0, 10);
        return {
          ...user,
          total_30d_seconds: totalSecs
        };
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

  // ✂️ নাম কাটার লজিক: স্পেসের আগের অংশটুকু নিবে
  const formatName = (name) => {
    if (!name) return "Scholar";
    return name.trim().split(' ')[0].charAt(0).toUpperCase() + name.trim().split(' ')[0].slice(1).toLowerCase();
  };

  const formattedDate = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'Asia/Dhaka'
  });

  const formattedTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true, 
    timeZone: 'Asia/Dhaka'
  });

  return (
    <div className="pt-6 font-sans text-slate-800 pb-24 px-3 relative">
      
      {/* 🚀 INJECTING CSS TO HIDE SCROLLBAR */}
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight flex items-center justify-center gap-2">
            <Trophy size={28} className="text-[#10a37f]" /> Daily Hall of Fame
          </h1>
          
          <p className="text-slate-500 font-normal mt-2.5 max-w-lg mx-auto text-sm sm:text-base leading-relaxed">
            Compete with peers, push your limits, and climb the ranks. 
            <br className="hidden sm:block" /> The leaderboard resets every night at <span className="font-semibold text-slate-700">12:00 AM</span>. Make today count! 
          </p>
          
          <div className="inline-flex items-center gap-2 mt-5 bg-sky-50/60 border border-sky-100 px-4 py-2 rounded-full shadow-sm text-sm font-medium text-slate-600 transition-all">
            {isTimeSynced ? (
              <>
                <CalendarClock size={16} className="text-[#10a37f]" />
                <span>Today {formattedDate} — {formattedTime}</span>
              </>
            ) : (
              <>
                <Loader2 size={16} className="text-[#10a37f] animate-spin" />
                <span className="text-slate-400">Syncing live time...</span>
              </>
            )}
          </div>
        </div>

        <div className="bg-sky-50/40 backdrop-blur-2xl border border-sky-100/60 shadow-sm rounded-3xl overflow-hidden">
          <div className="bg-white/60 flex justify-between p-4 sm:p-5 font-bold text-[10px] sm:text-xs text-slate-500 uppercase tracking-widest border-b border-sky-100/60">
            <span className="w-12 sm:w-16 text-center">Rank</span>
            <span className="flex-1 pl-2 sm:pl-4">Username</span>
            <span className="w-24 sm:w-32 text-right">Focus Time</span>
          </div>

          {/* ADDED "no-scrollbar" class here */}
          <div className="p-3 sm:p-4 space-y-2.5 max-h-[60vh] overflow-y-auto no-scrollbar">
            {!isTimeSynced || loading ? (
                <div className="flex justify-center py-10">
                    <span className="text-[#10a37f] font-bold tracking-widest uppercase text-xs animate-pulse">Fetching Live Standings...</span>
                </div>
            ) : leaders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 bg-white/40 rounded-[1.25rem] border border-dashed border-sky-200/60 h-full">
                <Trophy size={24} className="text-slate-300 mb-3" />
                <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">No focus sessions yet today.</p>
                <p className="text-[10px] text-slate-400 mt-1">Be the first to claim the #1 spot! 👑</p>
              </div>
            ) : (
              leaders.map((user, index) => {
                const stats = calculateStats(user.total_30d_seconds); // Calculate their real level
                
                return (
                  <div key={index} className="flex justify-between items-center p-3.5 sm:p-4 rounded-[1.25rem] bg-white border border-sky-50 shadow-sm transition-all hover:border-[#10a37f]/30">
                    
                    <span className="w-12 sm:w-16 text-center font-semibold text-slate-800 text-xl">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                    </span>
                    
                    {/* 🛠️ User Info Section Updated */}
                    <div className="flex-1 ml-2 sm:ml-4 min-w-0">
                      <p className="font-bold text-slate-800 text-[14px] sm:text-[15px] truncate leading-tight">
                        {formatName(user.profiles?.username)}
                      </p>
                      <div className="flex gap-1.5 mt-1">
                        <span className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md leading-none">
                          Lvl {stats.level}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border leading-none ${stats.rank.bg} ${stats.rank.color} ${stats.rank.border}`}>
                          {stats.rank.name}
                        </span>
                      </div>
                    </div>
                    
                    <span className="w-24 sm:w-32 text-right font-mono tracking-tight tabular-nums font-bold text-emerald-700 bg-emerald-100/80 px-3 py-1.5 rounded-full border border-emerald-200 shadow-inner">
                      {formatStudyTime(user.study_seconds)}
                    </span>
                    
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