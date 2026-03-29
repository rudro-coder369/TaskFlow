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

  useEffect(() => {
    let isMounted = true;
    let clockTimer;

    const syncRealBangladeshTime = async () => {
      let offset = 0;
      try {
        // 🚀 ১. First Priority Premium API (CORS friendly)
        const res1 = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=Asia/Dhaka');
        if (res1.ok) {
          const data = await res1.json();
          // API এর স্ট্রিংয়ের সাথে +06:00 যোগ করে পারফেক্ট টাইমস্ট্যাম্প বানানো
          const realTime = new Date(data.dateTime + "+06:00").getTime();
          offset = realTime - new Date().getTime();
        } else {
          throw new Error("API 1 Blocked");
        }
      } catch (err1) {
        try {
          // 🛡️ ২. Fallback API (যদি প্রথমটা ফেইল করে)
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
        setIsTimeSynced(true); // টাইম সিঙ্ক কমপ্লিট!
        
        // সিঙ্ক হওয়া একদম পারফেক্ট টাইম সেট করা
        const exactNow = new Date(new Date().getTime() + offset);
        setNow(exactNow);
        
        // বাংলাদেশের তারিখ অনুযায়ী ডেটাবেস ফেচ করার স্ট্রিং
        const dateStr = exactNow.toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' });
        currentDateStr.current = dateStr;
        
        fetchLeaderboard(dateStr);
        
        // ⏱️ ঘড়িটা এখন প্রতি সেকেন্ডে আপডেট হবে (একদম স্মুথ)
        clockTimer = setInterval(() => {
          setNow(new Date(new Date().getTime() + timeOffset.current));
        }, 1000);
      }
    };

    syncRealBangladeshTime();

    // 🔄 ডাটাবেস রিয়েল-টাইম লিসেনার
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
    const { data, error } = await supabase
      .from('daily_logs')
      .select('study_seconds, profiles(username)')
      .eq('date_str', dateString)
      .order('study_seconds', { ascending: false })
      .limit(50);
      
    if (data && !error) setLeaders(data);
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

  const formatName = (name) => {
    if (!name) return "Scholar";
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };

  // 🕒 BANGLADESH TIME & DATE FIX
  const formattedDate = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'Asia/Dhaka'
  });

  const formattedTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true, // AM/PM দেখাবে
    timeZone: 'Asia/Dhaka'
  });

  return (
    <div className="pt-6 font-sans text-slate-800 pb-24 px-3">
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight flex items-center justify-center gap-2">
            <Trophy size={28} className="text-[#10a37f]" /> Today's Leaderboard
          </h1>
          
          <div className="inline-flex items-center gap-2 mt-4 bg-sky-50/60 border border-sky-100 px-4 py-2 rounded-full shadow-sm text-sm font-medium text-slate-600 transition-all">
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
            <span className="w-24 sm:w-32 text-right">Focused Time</span>
          </div>

          <div className="p-3 sm:p-4 space-y-2.5 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {!isTimeSynced || loading ? (
                <div className="flex justify-center py-10">
                    <span className="text-[#10a37f] font-bold tracking-widest uppercase text-xs animate-pulse">Fetching Servers...</span>
                </div>
            ) : leaders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 bg-white/40 rounded-[1.25rem] border border-dashed border-sky-200/60 h-full">
                <Trophy size={24} className="text-slate-300 mb-3" />
                <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">No sessions recorded today.</p>
              </div>
            ) : (
              leaders.map((user, index) => (
                <div key={index} className="flex justify-between items-center p-3.5 sm:p-4 rounded-[1.25rem] bg-white border border-sky-50 shadow-sm transition-all hover:border-[#10a37f]/30">
                  
                  <span className="w-12 sm:w-16 text-center font-semibold text-slate-800 text-xl">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                  </span>
                  
                  <span className="flex-1 font-bold text-slate-800 text-[14px] sm:text-[15px] ml-2 sm:ml-4 truncate">
                    {formatName(user.profiles?.username)}
                  </span>
                  
                  {/* 🛠️ FIXED: Background updated to olive/light green, text to emerald, shape to rounded-full */}
                  <span className="w-24 sm:w-32 text-right font-mono tracking-tight tabular-nums font-bold text-emerald-700 bg-emerald-100/80 px-3 py-1.5 rounded-full border border-emerald-200 shadow-inner">
                    {formatStudyTime(user.study_seconds)}
                  </span>
                  
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}