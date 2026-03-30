import React, { useState, useEffect, useContext } from 'react';
import { Timer, Trophy, Sparkles, Medal, Zap, AlertOctagon, Crown, Flame } from 'lucide-react';
import { supabase } from '../services/supabase';
import { ProgressContext } from '../App';

export default function Dashboard() {
  const { userProfile } = useContext(ProgressContext);
  
  const currentDate = new Date().toLocaleDateString('en-GB', { 
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
  });

  const [loadingData, setLoadingData] = useState(true);
  const [topScholars, setTopScholars] = useState([]); 
  const [userStats, setUserStats] = useState({ 
    xp: 0, level: 1, totalHours: 0, missedYesterday: false, penalty: 0, currentRank: null 
  });

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

  // 🏆 XP & LEVEL LOGIC CALCULATOR (Clean Tailwind Colors)
  const calculateStats = (totalSeconds, penaltyXp = 0) => {
    const hours = totalSeconds / 3600;
    const level = Math.floor(hours / 2) + 1; 
    const rawXp = Math.floor(hours * 99); 
    const finalXp = Math.max(0, rawXp - penaltyXp);

    let rank = { name: 'Silver', color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200', min: 0, max: 1485, iconColor: 'text-slate-400' };
    
    if (finalXp >= 24750) rank = { name: 'Grandmaster', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', min: 24750, max: 50000, iconColor: 'text-purple-500' };
    else if (finalXp >= 14850) rank = { name: 'Master', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', min: 14850, max: 24750, iconColor: 'text-rose-500' };
    else if (finalXp >= 7920) rank = { name: 'Diamond', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', min: 7920, max: 14850, iconColor: 'text-indigo-500' };
    else if (finalXp >= 3960) rank = { name: 'Platinum', color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200', min: 3960, max: 7920, iconColor: 'text-sky-500' };
    else if (finalXp >= 1485) rank = { name: 'Gold', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', min: 1485, max: 3960, iconColor: 'text-amber-500' };

    const progress = Math.min(100, Math.max(0, ((finalXp - rank.min) / (rank.max - rank.min)) * 100));

    return { level, finalXp, rank, progress, hours };
  };

  // 📥 FETCH DATA & CALCULATE PENALTY
  useEffect(() => {
    const fetchDashboardData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoadingData(false);
        return;
      }

      const { data: myLogs } = await supabase.from('daily_logs').select('date_str, study_seconds').eq('user_id', session.user.id);
      
      let totalSecs = 0;
      const uniqueDays = new Set();
      let firstDate = null;

      if (myLogs && myLogs.length > 0) {
        myLogs.forEach(log => {
          totalSecs += parseInt(log.study_seconds || 0, 10);
          uniqueDays.add(log.date_str);
          
          const parts = log.date_str.split('/');
          const logDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
          if (!firstDate || logDate < firstDate) firstDate = logDate;
        });
      }

      let missedDays = 0;
      let missedYesterday = false;

      if (firstDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' });

        const diffTime = Math.abs(today - firstDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        missedDays = Math.max(0, diffDays - uniqueDays.size);
        if (!uniqueDays.has(yStr) && diffDays > 0) {
          missedYesterday = true;
        }
      }

      const penalty = missedDays * 200;
      const myStats = calculateStats(totalSecs, penalty);
      
      setUserStats({
        xp: myStats.finalXp,
        level: myStats.level,
        totalHours: myStats.hours,
        missedYesterday,
        penalty,
        currentRank: myStats.rank,
        progress: myStats.progress
      });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: lbData } = await supabase
        .from('daily_logs')
        .select('user_id, study_seconds, profiles(username)')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (lbData) {
        const userTotals = {};
        lbData.forEach(log => {
          const id = log.user_id;
          const name = log.profiles?.username || 'Scholar';
          const seconds = parseInt(log.study_seconds || 0, 10);
          if (!userTotals[id]) userTotals[id] = { name, totalSecs: 0 };
          userTotals[id].totalSecs += seconds;
        });

        const sorted = Object.values(userTotals)
          .sort((a, b) => b.totalSecs - a.totalSecs)
          .slice(0, 3);
        setTopScholars(sorted);
      }
      setLoadingData(false);
    };

    fetchDashboardData();
  }, []);

  const formatFirstName = (name) => {
    if (!name) return "Scholar";
    return name.trim().split(' ')[0].charAt(0).toUpperCase() + name.trim().split(' ')[0].slice(1).toLowerCase();
  };

  // 💎 UNIFIED TIMER SCREEN GLASSMORPHISM
  const skyGlassCard = "bg-sky-50/40 backdrop-blur-2xl border border-sky-100/60 shadow-sm rounded-3xl p-5 sm:p-6 transition-all duration-300";

  if (loadingData) return <div className="min-h-screen flex justify-center items-center text-[#10a37f] font-bold tracking-widest uppercase text-sm animate-pulse">Syncing Hub...</div>;

  return (
    <div className="pt-6 font-sans text-slate-800 pb-24 px-3">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        
        {/* HEADER & DATE */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-sky-100/50 pb-5 px-1">
          <div>
            <span className="text-slate-400 font-bold tracking-widest text-[10px] sm:text-xs mb-1.5 uppercase flex items-center gap-1.5">
              <Sparkles size={12} className="text-[#10a37f]" /> {currentDate}
            </span>
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-slate-900">Conquer your goals today.</h1>
          </div>
        </div>

        {/* 🎬 DAILY MOTIVATIONAL VIDEO */}
        <div className="bg-sky-50/40 backdrop-blur-2xl border border-sky-100/60 shadow-sm rounded-[2rem] p-2 sm:p-3 relative overflow-hidden group">
          <div className="absolute top-5 left-5 z-10 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-sky-100/50 shadow-sm flex items-center gap-1.5">
            <Flame size={14} className="text-orange-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Daily Motivation</span>
          </div>
          <video 
            src="/motivational.mp4" 
            controls
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-[200px] sm:h-[280px] object-cover rounded-3xl shadow-inner bg-slate-100/50"
          />
        </div>

        {/* 🚨 PENALTY ALERT POPUP */}
        {userStats.missedYesterday && (
          <div className="bg-rose-50/80 backdrop-blur-md border border-rose-100 p-4 rounded-3xl flex items-center gap-4 shadow-sm animate-pulse">
            <div className="bg-rose-100 p-2 rounded-full text-rose-500">
              <AlertOctagon size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-700 uppercase tracking-wide">Focus Broken!</p>
              <p className="text-xs text-rose-600 font-medium">You missed your study session yesterday. <span className="font-bold">-200 XP</span> deducted.</p>
            </div>
          </div>
        )}

        {/* 🌟 OPENAI STYLE CLEAN PROFILE CARD */}
        <div className={`${skyGlassCard} relative overflow-hidden`}>
          {/* Subtle Accent Glows (OpenAI Green & Sky Blue) */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#10a37f]/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-sky-400/10 rounded-full blur-3xl"></div>

          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
            <div className="flex items-center gap-4 w-full">
              {/* Profile Avatar */}
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#10a37f] to-sky-400 p-0.5 shadow-sm">
                <div className="w-full h-full bg-white rounded-full flex items-center justify-center text-[#10a37f] font-black text-2xl">
                  {formatFirstName(userProfile?.username).charAt(0)}
                </div>
              </div>
              
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{formatFirstName(userProfile?.username)}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="bg-white text-slate-600 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-sky-100 flex items-center gap-1 shadow-sm">
                    <Zap size={12} className="text-[#10a37f] fill-current" /> Lvl {userStats.level}
                  </span>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 border ${userStats.currentRank.border} ${userStats.currentRank.color} ${userStats.currentRank.bg} shadow-sm`}>
                    <Medal size={12} className={userStats.currentRank.iconColor} /> {userStats.currentRank.name}
                  </span>
                </div>
              </div>
            </div>

            {/* XP Data */}
            <div className="text-center sm:text-right w-full sm:w-auto bg-white/60 p-3.5 rounded-2xl border border-sky-50 shadow-sm">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Total Experience</p>
              <p className="text-2xl font-black text-slate-800 font-mono">{userStats.xp.toLocaleString()} <span className="text-sm text-[#10a37f]">XP</span></p>
            </div>
          </div>

          {/* Progress Bar inside Card */}
          <div className="relative z-10 mt-6 pt-5 border-t border-sky-100/50">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <Flame size={12} className="text-[#10a37f]" /> Rank Progress
              </span>
              <span className="text-xs font-bold text-[#10a37f]">{Math.round(userStats.progress)}%</span>
            </div>
            <div className="h-2 w-full bg-sky-100/50 rounded-full overflow-hidden shadow-inner">
              <div className="h-full bg-[#10a37f] transition-all duration-1000 relative" style={{ width: `${userStats.progress}%` }}>
                <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
            <div className="flex justify-between mt-1.5 text-[9px] font-bold text-slate-400">
              <span>{userStats.currentRank.min.toLocaleString()} XP</span>
              <span>{userStats.currentRank.max.toLocaleString()} XP</span>
            </div>
          </div>
        </div>

        {/* 1️⃣ COUNTDOWN */}
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

        {/* 2️⃣ THE ELITE LEADERBOARD */}
        <div className={skyGlassCard}>
           <div className="flex items-center justify-between mb-6 border-b border-sky-100/50 pb-4">
             <div className="flex items-center gap-2.5">
               <Trophy size={18} className="text-[#10a37f]" strokeWidth={2.5} />
               <span className="text-[14px] font-bold text-slate-800 tracking-tight uppercase">Live Competition</span>
             </div>
           </div>
           
           {topScholars.length === 0 ? (
              <div className="w-full text-center py-6 bg-white/40 rounded-3xl border border-dashed border-sky-200">
                <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">Race starting soon...</span>
              </div>
           ) : (
             <div className="flex flex-col gap-4">
               {/* 👑 1ST PLACE - TEAL/GREEN CLEAN CARD */}
               {topScholars[0] && (
                 <div className={`relative bg-[#10a37f]/5 border border-[#10a37f]/30 rounded-3xl p-5 shadow-sm flex items-center gap-4`}>
                   <div className="absolute -top-3 -right-3 bg-white border border-[#10a37f]/20 text-[#10a37f] w-8 h-8 rounded-full flex items-center justify-center shadow-sm animate-bounce">
                     <Crown size={16} className="fill-current" />
                   </div>
                   
                   <div className="w-12 h-12 rounded-full bg-[#10a37f] text-white flex items-center justify-center text-xl font-black shadow-inner">
                     1
                   </div>
                   
                   <div className="flex-1">
                     <p className="text-lg font-bold text-slate-800 leading-tight">
                       {formatFirstName(topScholars[0].name)}
                     </p>
                     <div className="flex gap-2 mt-1.5">
                       <span className="text-[10px] font-bold text-[#10a37f] bg-white px-2 py-0.5 rounded-md border border-[#10a37f]/20 shadow-sm">
                         Lvl {calculateStats(topScholars[0].totalSecs).level}
                       </span>
                       <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 shadow-sm ${calculateStats(topScholars[0].totalSecs).rank.bg} ${calculateStats(topScholars[0].totalSecs).rank.color}`}>
                         {calculateStats(topScholars[0].totalSecs).rank.name}
                       </span>
                     </div>
                   </div>
                   
                   <div className="text-right">
                     <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total XP</span>
                     <span className="text-xl font-black text-[#10a37f]">{calculateStats(topScholars[0].totalSecs).finalXp.toLocaleString()}</span>
                   </div>
                 </div>
               )}

               {/* 🥈 & 🥉 2ND & 3RD PLACE */}
               <div className="flex flex-col sm:flex-row gap-4">
                 {[topScholars[1], topScholars[2]].map((scholar, index) => {
                   if (!scholar) return null;
                   const pos = index + 2;
                   const stats = calculateStats(scholar.totalSecs);
                   const isSecond = pos === 2;
                   
                   return (
                     <div key={pos} className={`flex-1 flex items-center gap-3 p-4 rounded-3xl border bg-white/60 shadow-sm transition-all ${isSecond ? 'border-sky-200' : 'border-slate-200'}`}>
                       <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center text-sm font-black shadow-inner ${isSecond ? 'bg-sky-500' : 'bg-slate-400'}`}>
                         {pos}
                       </div>
                       
                       <div className="flex-1 min-w-0">
                         <p className="text-[14px] font-bold text-slate-800 truncate leading-tight">
                           {formatFirstName(scholar.name)}
                         </p>
                         <p className="text-[10px] font-medium text-slate-500 mt-0.5 truncate flex items-center gap-1.5">
                           Lvl {stats.level} <span className="text-slate-300">|</span> <span className={stats.rank.color}>{stats.rank.name}</span>
                         </p>
                       </div>
                       
                       <div className="text-right">
                         <span className="block text-sm font-black text-slate-700">{stats.finalXp.toLocaleString()}</span>
                         <span className="text-[9px] font-bold text-slate-400 uppercase">XP</span>
                       </div>
                     </div>
                   );
                 })}
               </div>
             </div>
           )}
        </div>

      </div>
    </div>
  );
}