import React, { useState, useEffect } from 'react';
import { Timer, Trophy, Loader2, Users, Flame, Moon, Sparkles } from 'lucide-react';
import { supabase } from '../services/supabase';

export default function Dashboard() {
  const currentDate = new Date().toLocaleDateString('en-GB', { 
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
  });

  const [loadingData, setLoadingData] = useState(true);
  const [topScholars, setTopScholars] = useState([]); 
  const [onlineScholars, setOnlineScholars] = useState([]);

  // ⏱️ SSC 2026 LIVE COUNTDOWN
  const calculateTimeLeft = () => {
    const difference = +new Date('2026-12-01T00:00:00') - +new Date();
    let timeLeft = { days: 0, hours: 0, minutes: 0, seconds: 0 };
    if (difference > 0) {
      timeLeft = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }
    return timeLeft;
  };
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 📥 FETCH DATA & LIVE PRESENCE
  useEffect(() => {
    const fetchTopScholars = async () => {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      firstDayOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('daily_logs')
        .select('user_id, study_seconds, profiles(username)')
        .gte('created_at', firstDayOfMonth.toISOString()); 

      if (data && !error) {
        const userTotals = {};
        data.forEach(log => {
          const id = log.user_id;
          const name = log.profiles?.username || 'Scholar';
          const seconds = parseInt(log.study_seconds || 0, 10);
          if (!userTotals[id]) userTotals[id] = { name, totalSeconds: 0 };
          userTotals[id].totalSeconds += seconds;
        });

        const sorted = Object.values(userTotals)
          .sort((a, b) => b.totalSeconds - a.totalSeconds)
          .slice(0, 3);
        setTopScholars(sorted);
      }
      setLoadingData(false);
    };

    fetchTopScholars();

    const dbChannel = supabase.channel('public:daily_logs_dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_logs' }, () => {
        fetchTopScholars();
      }).subscribe();

    const room = supabase.channel('study_room');
    room.on('presence', { event: 'sync' }, () => {
      const newState = room.presenceState();
      const activeUsers = [];
      for (const id in newState) {
        newState[id].forEach(userState => activeUsers.push(userState));
      }
      const uniqueUsers = Array.from(new Map(activeUsers.map(item => [item.username, item])).values());
      setOnlineScholars(uniqueUsers);
    }).subscribe();

    return () => {
      supabase.removeChannel(dbChannel);
      supabase.removeChannel(room);
    };
  }, []);

  const formatStudyTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const formatName = (name) => {
    if (!name) return "Scholar";
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };

  // 💎 ENTRY POINT GLASSMORPHISM
  const skyGlassCard = "bg-sky-50/70 backdrop-blur-2xl border border-sky-100/80 shadow-[0_8px_32px_0_rgba(224,242,254,0.6)] rounded-[1.5rem] p-5 sm:p-6 transition-all duration-300";

  if (loadingData) return <div className="min-h-screen flex justify-center items-center text-[#10a37f] font-bold tracking-widest uppercase text-sm animate-pulse">Syncing Hub...</div>;

  const rankStyles = [
    { border: 'border-[#10a37f]/30', text: 'text-[#10a37f]', badgeBg: 'bg-[#10a37f]' }, 
    { border: 'border-sky-300/50', text: 'text-sky-600', badgeBg: 'bg-sky-500' }, 
    { border: 'border-slate-200', text: 'text-slate-500', badgeBg: 'bg-slate-400' }, 
  ];

  return (
    <div className="pt-6 font-sans text-slate-800 pb-24 px-3">
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-sky-100/60 pb-5 px-1">
          <div>
            <span className="text-slate-400 font-bold tracking-widest text-[10px] sm:text-xs mb-1.5 uppercase flex items-center gap-1.5">
              <Sparkles size={12} className="text-[#10a37f]" /> {currentDate}
            </span>
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-slate-800">Conquer your goals today.</h1>
          </div>
        </div>

        {/* 1️⃣ PERFECT SCALED SSC COUNTDOWN */}
        <div className={`${skyGlassCard} flex flex-col sm:flex-row items-center sm:justify-between gap-5`}>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-3">
              <div className="bg-sky-50 p-3 rounded-2xl text-sky-500 border border-sky-100 shadow-sm">
                <Timer size={22} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-[16px] sm:text-lg font-bold text-slate-800 tracking-tight leading-none uppercase">SSC 2026</h2>
                <p className="text-[10px] text-slate-400 font-bold mt-1.5 uppercase tracking-widest">Countdown</p>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2.5 text-center items-center justify-center sm:justify-end w-full sm:w-auto pt-2 sm:pt-0">
            {[ {v: timeLeft.days, l: 'Day'}, {v: timeLeft.hours, l: 'Hr'}, {v: timeLeft.minutes, l: 'Min'}, {v: timeLeft.seconds, l: 'Sec', c: 'text-[#10a37f] bg-[#10a37f]/5 border-[#10a37f]/20'} ].map((t, i) => (
              <React.Fragment key={i}>
                <div className={`flex flex-col items-center justify-center w-[54px] h-[58px] sm:w-[64px] sm:h-[68px] border rounded-[1.25rem] shadow-sm transition-all ${t.c || 'bg-white/90 border-sky-100/80'}`}>
                  <span className={`text-2xl sm:text-3xl font-light tabular-nums leading-none tracking-tight ${t.c ? 'text-[#10a37f]' : 'text-slate-600'}`}>{String(t.v).padStart(2, '0')}</span>
                  <span className={`text-[9px] font-medium uppercase tracking-widest mt-1.5 ${t.c ? 'text-[#10a37f]/80' : 'text-slate-400'}`}>{t.l}</span>
                </div>
                {i < 3 && <span className="text-2xl font-light text-slate-300 -mx-0.5">:</span>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* 2️⃣ HORIZONTAL LIVE COMPETITION */}
        <div className={skyGlassCard}>
           <div className="flex items-center justify-between mb-5 border-b border-sky-100/50 pb-4">
             <div className="flex items-center gap-2.5">
               <Trophy size={18} className="text-[#10a37f]" strokeWidth={2.5} />
               <span className="text-[14px] font-bold text-slate-800 tracking-tight uppercase">Live Competition</span>
             </div>
           </div>
           
           <div className="flex gap-3 sm:gap-4">
              {topScholars.length === 0 ? (
                <div className="w-full text-center py-6 bg-sky-50/40 rounded-2xl border border-dashed border-sky-200/50">
                  <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">Race starting soon...</span>
                </div>
              ) : (
                topScholars.map((scholar, i) => (
                   <div key={i} className={`flex-1 flex flex-col items-center justify-center p-4 rounded-[1.25rem] border bg-white/80 backdrop-blur-md shadow-sm hover:shadow-md transition-all ${rankStyles[i]?.border || 'border-slate-200'}`}>
                      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full text-white flex items-center justify-center text-sm font-black mb-2.5 shadow-sm ${rankStyles[i]?.badgeBg || 'bg-slate-400'}`}>
                        {i + 1}
                      </div>
                      <span className="text-[13px] sm:text-[14px] font-bold text-slate-800 truncate w-full text-center leading-tight">{formatName(scholar.name)}</span>
                      <span className={`text-[10px] sm:text-[11px] font-bold tracking-tight mt-1.5 uppercase ${rankStyles[i]?.text || 'text-slate-500'}`}>{formatStudyTime(scholar.totalSeconds)}</span>
                   </div>
                ))
              )}
           </div>
        </div>

        {/* 3️⃣ COMPACT LIVE ROOM */}
        <div className={`${skyGlassCard} flex flex-col min-h-[180px] max-h-[300px]`}>
          <div className="flex justify-between items-center mb-5 border-b border-sky-100/50 pb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <Users size={18} className="text-sky-500" strokeWidth={2.5} />
                <span className="text-[14px] font-bold text-slate-800 tracking-tight uppercase">Live Room</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-1">See who is studying</p>
            </div>
            <div className="flex items-center gap-2 bg-[#10a37f]/10 px-3 py-1.5 rounded-full border border-[#10a37f]/20">
              <span className="relative flex h-2 w-2">
                {onlineScholars.length > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10a37f] opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${onlineScholars.length > 0 ? 'bg-[#10a37f]' : 'bg-slate-400'}`}></span>
              </span>
              <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-widest ${onlineScholars.length > 0 ? 'text-[#10a37f]' : 'text-slate-500'}`}>{onlineScholars.length} Online</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-3 pb-1 custom-scrollbar">
            {onlineScholars.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center bg-white/50 rounded-[1.25rem] border border-dashed border-sky-200/60 h-full">
                <Moon size={24} className="text-slate-300 mb-3" />
                <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">Room is empty.</p>
              </div>
            ) : (
              onlineScholars.map((user, idx) => (
                <div key={idx} className="flex items-center gap-3.5 bg-white/70 backdrop-blur-md border border-sky-100 hover:border-[#10a37f]/30 p-3.5 rounded-[1.25rem] shadow-sm transition-all duration-300">
                  <div className="w-10 h-10 bg-sky-50 rounded-full flex items-center justify-center text-sky-600 text-sm font-black border border-sky-100 uppercase shadow-inner">
                    {formatName(user.username).substring(0, 1)}
                  </div>
                  <div className="flex-1 overflow-hidden leading-tight">
                    <span className="text-[14px] font-bold text-slate-800 block truncate">{formatName(user.username)}</span>
                    <span className="text-[10px] sm:text-[11px] font-bold text-[#10a37f] flex items-center gap-1.5 mt-1.5 truncate uppercase tracking-widest">
                      <Flame size={12} className="fill-current" /> {user.task || "Deep Work"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}