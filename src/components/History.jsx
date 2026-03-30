import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Clock, CalendarDays, History as HistoryIcon, TrendingUp, BarChart3, Target } from 'lucide-react';

export default function History() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null); 
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const { data, error } = await supabase
      .from('daily_logs')
      .select('date_str, study_seconds, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(30);
      
    if (data && !error) setLogs(data);
    setLoading(false);
  };

  // 📊 GRAPH LOGIC: Generate exactly 30 days timeline
  const graphData = useMemo(() => {
    if (loading) return [];
    
    const dataMap = new Map(logs.map(log => [log.date_str, log.study_seconds]));
    const result = [];
    
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' });
      
      const seconds = dataMap.get(dStr) || 0;
      result.push({
        fullDate: dStr,
        dayName: d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Asia/Dhaka' }), 
        label: i === 0 ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' }),
        hours: seconds / 3600,
        seconds: seconds,
        isToday: i === 0
      });
    }
    return result;
  }, [logs, loading]);

  // Set initial selected day to "Today" and auto-scroll to end
  useEffect(() => {
    if (graphData.length > 0 && !selectedDay) {
      setSelectedDay(graphData[graphData.length - 1]); 
    }
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [graphData]);

  // 📈 STATS CALCULATION
  const stats = useMemo(() => {
    const totalSecs = logs.reduce((acc, curr) => acc + parseInt(curr.study_seconds || 0), 0);
    const maxSecs = logs.length > 0 ? Math.max(...logs.map(l => parseInt(l.study_seconds || 0))) : 0;
    const avgSecs = logs.length > 0 ? totalSecs / 30 : 0; 
    
    // Calculate Y-Axis Steps for Grid 
    const maxHours = maxSecs / 3600;
    const maxGridLimit = Math.max(3, Math.ceil(maxHours / 3) * 3); 

    return {
      total: (totalSecs / 3600).toFixed(1),
      avg: (avgSecs / 3600).toFixed(1),
      max: (maxSecs / 3600).toFixed(1),
      gridMax: maxGridLimit
    };
  }, [logs]);

  const formatBigTime = (totalSeconds) => {
    const validSeconds = parseInt(totalSeconds, 10);
    if (isNaN(validSeconds) || validSeconds <= 0) return "0 hr, 0 min";
    const h = Math.floor(validSeconds / 3600);
    const m = Math.floor((validSeconds % 3600) / 60);
    if (h > 0) return `${h} hr, ${m} min`;
    return `${m} min`;
  };

  const formatListTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // 💎 PURE SKY BLUE GLASSMORPHISM
  const skyGlassCard = "bg-sky-50/70 backdrop-blur-2xl border border-sky-100/80 shadow-[0_8px_32px_0_rgba(224,242,254,0.6)] rounded-[1.5rem] p-5 transition-all duration-300";

  if (loading) return <div className="min-h-screen flex justify-center items-center text-[#10a37f] font-bold tracking-widest uppercase text-sm animate-pulse">Analyzing Archives...</div>;

  return (
    <div className="pt-6 font-sans text-slate-800 pb-24 px-3">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-sky-100/60 pb-5 px-1">
          <div>
            <span className="text-slate-400 font-bold tracking-widest text-[10px] sm:text-xs mb-1.5 uppercase block">
              Performance Analytics
            </span>
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-slate-800">Your Focus Journey.</h1>
          </div>
        </div>

        {/* 🏆 TOP STATS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={`${skyGlassCard} flex items-center gap-4 border-l-4 border-l-[#10a37f]`}>
            <div className="p-3 bg-[#10a37f]/10 rounded-2xl text-[#10a37f]"><TrendingUp size={20} /></div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Focus</p>
              <p className="text-xl font-bold text-slate-800">{stats.total} <span className="text-xs font-medium">Hrs</span></p>
            </div>
          </div>
          <div className={`${skyGlassCard} flex items-center gap-4 border-l-4 border-l-sky-400`}>
            <div className="p-3 bg-sky-100/50 rounded-2xl text-sky-500"><Target size={20} /></div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Daily Avg</p>
              <p className="text-xl font-bold text-slate-800">{stats.avg} <span className="text-xs font-medium">Hrs</span></p>
            </div>
          </div>
          <div className={`${skyGlassCard} flex items-center gap-4 border-l-4 border-l-[#10a37f]/60`}>
            <div className="p-3 bg-[#10a37f]/10 rounded-2xl text-[#10a37f]/80"><BarChart3 size={20} /></div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Best Session</p>
              <p className="text-xl font-bold text-slate-800">{stats.max} <span className="text-xs font-medium">Hrs</span></p>
            </div>
          </div>
        </div>

        {/* 📊 APPLE-STYLE INTERACTIVE GRAPH CARD (Sky Blue Glassmorphism) */}
        <div className={`${skyGlassCard} pb-8`}>
          
          {/* BIG SELECTED DAY INFO */}
          <div className="text-center mb-8">
            <h2 className="text-4xl font-light text-slate-800 tracking-tight">
              {selectedDay ? formatBigTime(selectedDay.seconds) : "0 hr, 0 min"}
            </h2>
            <p className="text-sm font-medium text-slate-400 mt-1">
              {selectedDay ? selectedDay.label : "Select a day"}
            </p>
          </div>

          <div className="relative w-full h-56 sm:h-64">
            
            {/* 📏 BACKGROUND HORIZONTAL GRID LINES */}
            <div className="absolute inset-y-0 left-0 right-0 flex flex-col justify-between pb-8 pointer-events-none z-0">
              {[stats.gridMax, stats.gridMax * 0.66, stats.gridMax * 0.33, 0].map((val, idx) => (
                <div key={idx} className="relative flex items-end w-full">
                  <div className="flex-1 border-b border-sky-200/50"></div>
                  <span className="text-[10px] font-medium text-slate-400 ml-2 w-5 text-right bg-sky-50/40 pl-1 rounded">
                    {Math.round(val)}h
                  </span>
                </div>
              ))}
            </div>

            {/* 📈 SCROLLABLE BARS CONTAINER (Scrollbar Hidden via CSS) */}
            <style dangerouslySetInnerHTML={{__html: `
              .no-scrollbar::-webkit-scrollbar { display: none; }
              .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />
            
            <div ref={scrollRef} className="absolute inset-0 flex items-end justify-start overflow-x-auto pb-8 z-10 no-scrollbar snap-x snap-mandatory scroll-smooth">
              {graphData.map((day, idx) => {
                const heightPercent = Math.max(1, Math.min(100, (day.hours / stats.gridMax) * 100)); 
                const isSelected = selectedDay?.fullDate === day.fullDate;

                return (
                  <div 
                    key={idx} 
                    onClick={() => setSelectedDay(day)}
                    className="w-[14.28%] min-w-[14.28%] flex-shrink-0 flex flex-col items-center group relative h-full justify-end snap-center px-1.5 sm:px-3 cursor-pointer"
                  >
                    {/* The Interactive Bar */}
                    <div 
                      className={`w-full max-w-[40px] rounded-t-md transition-all duration-300 shadow-sm
                        ${isSelected ? 'bg-[#10a37f]' : day.hours > 0 ? 'bg-sky-200/60 hover:bg-sky-300/60' : 'bg-transparent'}
                      `}
                      style={{ height: `${day.hours > 0 ? heightPercent : 1}%` }}
                    ></div>
                    
                    {/* X-Axis Day Name (Sun, Mon, Tue...) */}
                    <span className={`text-[10px] sm:text-xs font-bold mt-2 absolute -bottom-6 text-center whitespace-nowrap transition-colors
                      ${isSelected ? 'text-[#10a37f]' : 'text-slate-500'}
                    `}>
                      {day.dayName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 📚 DETAILED LOG LIST */}
        <div className={skyGlassCard}>
          <div className="flex items-center justify-between mb-5 border-b border-sky-100/50 pb-4">
            <div className="flex items-center gap-2.5">
              <HistoryIcon size={18} className="text-sky-500" strokeWidth={2.5} />
              <span className="text-[14px] font-bold text-slate-800 tracking-tight uppercase">Detailed Archive</span>
            </div>
          </div>

          <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 bg-white/40 rounded-[1.25rem] border border-dashed border-sky-200/60 h-full">
                <Clock size={24} className="text-slate-300 mb-3" />
                <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">No study sessions logged yet.</p>
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="bg-white/80 backdrop-blur-md border border-sky-100 hover:border-[#10a37f]/30 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex justify-between items-center group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center text-sky-500 border border-sky-100 group-hover:bg-[#10a37f]/10 group-hover:text-[#10a37f] transition-colors">
                      <CalendarDays size={18} strokeWidth={2.5} />
                    </div>
                    <span className="text-sm font-bold text-slate-700">
                      {log.date_str}
                    </span>
                  </div>
                  
                  <div className="font-mono text-sm tracking-tight tabular-nums font-bold px-3 py-1.5 rounded-xl bg-slate-50 text-slate-600 border border-slate-100 group-hover:bg-[#10a37f]/10 group-hover:text-[#10a37f] group-hover:border-[#10a37f]/20 transition-colors">
                    {formatListTime(log.study_seconds)}
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