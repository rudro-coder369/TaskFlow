import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Clock, CalendarDays, History as HistoryIcon, TrendingUp, BarChart3, Target, BookOpen, GraduationCap } from 'lucide-react';

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
      .select('date_str, study_seconds, self_study_seconds, class_seconds, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(30);
      
    if (data && !error) setLogs(data);
    setLoading(false);
  };

  // 🕒 TIME FORMATTING UTILS
  const formatSimpleTime = (totalSeconds) => {
    const secs = parseInt(totalSeconds, 10);
    if (isNaN(secs) || secs <= 0) return "0m";
    
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);

    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatBigTime = (totalSeconds) => {
    const secs = parseInt(totalSeconds, 10);
    if (isNaN(secs) || secs <= 0) return "0 min";
    
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);

    let parts = [];
    if (h > 0) parts.push(`${h} hr`);
    if (m > 0) parts.push(`${m} min`);
    if (h === 0 && s > 0) parts.push(`${s} sec`); 

    return parts.join(' ') || "0 min";
  };

  // 📊 GRAPH LOGIC
  const graphData = useMemo(() => {
    if (loading) return [];
    
    const dataMap = new Map(logs.map(log => [
      log.date_str, 
      {
        total: parseInt(log.study_seconds || 0),
        self: parseInt(log.self_study_seconds || 0),
        cls: parseInt(log.class_seconds || 0)
      }
    ]));

    const result = [];
    
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' });
      
      const dayData = dataMap.get(dStr) || { total: 0, self: 0, cls: 0 };
      
      result.push({
        fullDate: dStr,
        dayName: d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Asia/Dhaka' }), 
        label: i === 0 ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' }),
        hoursForGrid: dayData.total / 3600, // Only used for graph height
        seconds: dayData.total,
        selfSeconds: dayData.self,
        classSeconds: dayData.cls,
        isToday: i === 0
      });
    }
    return result;
  }, [logs, loading]);

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
    const avgSecs = logs.length > 0 ? totalSecs / logs.length : 0; 
    
    const maxHoursGrid = maxSecs / 3600;
    const maxGridLimit = Math.max(3, Math.ceil(maxHoursGrid / 3) * 3); 

    return {
      total: formatSimpleTime(totalSecs),
      avg: formatSimpleTime(avgSecs),
      max: formatSimpleTime(maxSecs),
      gridMax: maxGridLimit
    };
  }, [logs]);

  // 💎 STYLING
  const cardStyle = "bg-white/70 backdrop-blur-2xl border border-sky-100 shadow-sm rounded-3xl p-5 sm:p-6 transition-all duration-300 hover:shadow-md";

  if (loading) return <div className="min-h-screen flex justify-center items-center text-[#10a37f] font-bold tracking-widest uppercase text-sm animate-pulse">Analyzing Archives...</div>;

  return (
    <div className="pt-6 font-sans text-slate-800 pb-24 px-3">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        
        {/* HEADER */}
        <div className="border-b border-sky-100/60 pb-5 px-1">
          <span className="text-slate-400 font-bold tracking-widest text-[10px] sm:text-xs mb-1.5 uppercase block">
            Performance Analytics
          </span>
          <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-slate-800">Your Focus Journey.</h1>
        </div>

        {/* 🏆 TOP STATS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={`${cardStyle} flex items-center gap-4`}>
            <div className="p-3.5 bg-[#10a37f]/10 rounded-2xl text-[#10a37f]"><TrendingUp size={22} /></div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Focus</p>
              <p className="text-xl font-bold text-slate-800">{stats.total}</p>
            </div>
          </div>
          <div className={`${cardStyle} flex items-center gap-4`}>
            <div className="p-3.5 bg-sky-100/50 rounded-2xl text-sky-500"><Target size={22} /></div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Daily Avg</p>
              <p className="text-xl font-bold text-slate-800">{stats.avg}</p>
            </div>
          </div>
          <div className={`${cardStyle} flex items-center gap-4`}>
            <div className="p-3.5 bg-indigo-50 rounded-2xl text-indigo-500"><BarChart3 size={22} /></div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Best Session</p>
              <p className="text-xl font-bold text-slate-800">{stats.max}</p>
            </div>
          </div>
        </div>

        {/* 📊 INTERACTIVE GRAPH CARD */}
        <div className={`${cardStyle} pb-8`}>
          
          {/* BIG SELECTED DAY INFO & BREAKDOWN */}
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-light text-slate-800 tracking-tight">
              {selectedDay ? formatBigTime(selectedDay.seconds) : "0 min"}
            </h2>
            <p className="text-sm font-medium text-slate-400 mt-1">
              {selectedDay ? selectedDay.label : "Select a day"}
            </p>
            
            {/* Breakdown Badges */}
            {selectedDay && selectedDay.seconds > 0 && (
              <div className="flex items-center justify-center gap-4 mt-4 bg-sky-50/50 w-fit mx-auto px-4 py-2 rounded-xl border border-sky-100">
                <span className="text-xs font-bold text-slate-600 tracking-wide flex items-center gap-1.5">
                  <BookOpen size={14} className="text-[#10a37f]"/> Self: {formatSimpleTime(selectedDay.selfSeconds)}
                </span>
                <span className="text-sky-200">|</span>
                <span className="text-xs font-bold text-slate-600 tracking-wide flex items-center gap-1.5">
                  <GraduationCap size={14} className="text-indigo-500"/> Class: {formatSimpleTime(selectedDay.classSeconds)}
                </span>
              </div>
            )}
          </div>

          <div className="relative w-full h-56 sm:h-64">
            
            {/* 📏 BACKGROUND HORIZONTAL GRID LINES */}
            <div className="absolute inset-y-0 left-0 right-0 flex flex-col justify-between pb-8 pointer-events-none z-0">
              {[stats.gridMax, stats.gridMax * 0.66, stats.gridMax * 0.33, 0].map((val, idx) => (
                <div key={idx} className="relative flex items-end w-full">
                  <div className="flex-1 border-b border-sky-100"></div>
                  <span className="text-[10px] font-medium text-slate-400 ml-2 w-5 text-right">
                    {Math.round(val)}h
                  </span>
                </div>
              ))}
            </div>

            <style dangerouslySetInnerHTML={{__html: `
              .no-scrollbar::-webkit-scrollbar { display: none; }
              .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />
            
            <div ref={scrollRef} className="absolute inset-0 flex items-end justify-start overflow-x-auto pb-8 z-10 no-scrollbar snap-x snap-mandatory scroll-smooth">
              {graphData.map((day, idx) => {
                const heightPercent = Math.max(1, Math.min(100, (day.hoursForGrid / stats.gridMax) * 100)); 
                const isSelected = selectedDay?.fullDate === day.fullDate;

                return (
                  <div 
                    key={idx} 
                    onClick={() => setSelectedDay(day)}
                    className="w-[14.28%] min-w-[14.28%] flex-shrink-0 flex flex-col items-center group relative h-full justify-end snap-center px-1.5 sm:px-3 cursor-pointer"
                  >
                    <div 
                      className={`w-full max-w-[36px] rounded-t-lg transition-all duration-300 shadow-sm
                        ${isSelected ? 'bg-[#10a37f]' : day.seconds > 0 ? 'bg-sky-200/60 hover:bg-sky-300/80' : 'bg-transparent'}
                      `}
                      style={{ height: `${day.seconds > 0 ? heightPercent : 1}%` }}
                    ></div>
                    
                    <span className={`text-[10px] sm:text-xs font-bold mt-2 absolute -bottom-6 text-center whitespace-nowrap transition-colors
                      ${isSelected ? 'text-[#10a37f]' : 'text-slate-400'}
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
        <div className={cardStyle}>
          <div className="flex items-center justify-between mb-5 border-b border-sky-100/50 pb-4">
            <div className="flex items-center gap-2.5">
              <HistoryIcon size={18} className="text-sky-500" strokeWidth={2.5} />
              <span className="text-[14px] font-bold text-slate-800 tracking-tight uppercase">Detailed Archive</span>
            </div>
          </div>

          <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 bg-sky-50/40 rounded-2xl border border-dashed border-sky-200 h-full">
                <Clock size={24} className="text-slate-300 mb-3" />
                <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">No study sessions logged yet.</p>
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="bg-white border border-sky-50 hover:border-[#10a37f]/30 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex justify-between items-center group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center text-sky-500 border border-sky-100 group-hover:bg-[#10a37f]/10 group-hover:text-[#10a37f] transition-colors">
                      <CalendarDays size={18} strokeWidth={2.5} />
                    </div>
                    <span className="text-sm font-bold text-slate-700">
                      {log.date_str}
                    </span>
                  </div>
                  
                  <div className="flex flex-col items-end">
                    <div className="font-mono text-sm tracking-tight tabular-nums font-bold px-3 py-1.5 rounded-xl bg-slate-50 text-slate-600 border border-slate-100 group-hover:bg-[#10a37f]/10 group-hover:text-[#10a37f] group-hover:border-[#10a37f]/20 transition-colors">
                      {formatSimpleTime(log.study_seconds)}
                    </div>
                    
                    {(log.self_study_seconds > 0 || log.class_seconds > 0) && (
                      <div className="flex gap-2 mt-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                          <BookOpen size={10} className="text-[#10a37f]"/> {formatSimpleTime(log.self_study_seconds)}
                        </span>
                        <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                          <GraduationCap size={10} className="text-indigo-500"/> {formatSimpleTime(log.class_seconds)}
                        </span>
                      </div>
                    )}
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