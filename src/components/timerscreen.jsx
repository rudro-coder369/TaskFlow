import React, { useState, useContext, useEffect, useRef } from 'react';
import { initialData } from '../data/initialData';
import { Droplets, Utensils, Moon, Activity, BookOpen, Plus, Check, Trash2, Play, Pause, GraduationCap, Palette } from 'lucide-react';
import { ProgressContext } from '../App';
import { supabase } from '../services/supabase';

export default function TimerScreen() {
  const { syncSyllabusFromTodo, userProfile } = useContext(ProgressContext);

  const [habits, setHabits] = useState({ water: 0, meal: 0, prayer: 0, sleepChecked: false, exerciseChecked: false });
  const [todos, setTodos] = useState([]);
  const [studySeconds, setStudySeconds] = useState(0); 
  const [loadingData, setLoadingData] = useState(true);
  
  const [taskMode, setTaskMode] = useState('academic'); 
  
  // 📚 Group Selection State
  const [activeGroup, setActiveGroup] = useState(() => {
    return localStorage.getItem('academic_group') || 'science';
  });

  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedActions, setSelectedActions] = useState(['basic']); 
  const [customTaskInput, setCustomTaskInput] = useState("");

  // ⏱️ INLINE TIMER STATE (Background Proofed)
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const timerRef = useRef(null);
  const sessionStartRef = useRef(null);

  // 🟢 SUPABASE PRESENCE
  const roomChannelRef = useRef(null);
  const trueDateStr = useRef(new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' }));

  // 🕛 STATE TRACKER FOR MIDNIGHT SPLIT & PRESENCE
  const currentState = useRef({ habits, todos, studySeconds, activeTaskId });
  useEffect(() => {
    currentState.current = { habits, todos, studySeconds, activeTaskId };
  }, [habits, todos, studySeconds, activeTaskId]);

  useEffect(() => {
    localStorage.setItem('academic_group', activeGroup);
    setSelectedSubject('');
    setSelectedChapter('');
  }, [activeGroup]);

  const filteredSubjects = Object.entries(initialData.academics).filter(
    ([key, data]) => data.groups && data.groups.includes(activeGroup)
  );

  useEffect(() => {
    let isMounted = true;

    const initializeWorkspace = async () => {
      try {
        const res = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=Asia/Dhaka');
        if (res.ok) {
          const data = await res.json();
          const realTime = new Date(data.dateTime + "+06:00");
          trueDateStr.current = realTime.toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' });
        }
      } catch (err) {
        console.warn("API Sync failed. Using Local BD Time.");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.from('daily_logs').select('*').eq('user_id', session.user.id).eq('date_str', trueDateStr.current).single();

      if (data && !error) {
        setHabits({
          water: data.water || 0, meal: data.meal || 0, prayer: data.prayer || 0,
          sleepChecked: data.sleep || false, exerciseChecked: data.workout || false
        });
        if (data.todos) setTodos(data.todos);
        if (data.study_seconds) setStudySeconds(parseInt(data.study_seconds, 10));
      }
      setLoadingData(false);

      // 🔄 RECOVER BACKGROUND TIMER (Navigating away or YouTube mode)
      const savedTaskId = localStorage.getItem('active_task_id');
      const savedStart = localStorage.getItem('active_task_start');

      if (savedTaskId && savedStart && isMounted) {
        const startDate = new Date(Number(savedStart)).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' });
        
        if (startDate === trueDateStr.current) {
          console.log("Recovering background task...");
          setActiveTaskId(Number(savedTaskId));
          sessionStartRef.current = Number(savedStart);
          
          timerRef.current = setInterval(() => {
            const diff = Math.floor((Date.now() - Number(savedStart)) / 1000);
            setLiveSeconds(diff);
          }, 1000);
        } else {
          localStorage.removeItem('active_task_id');
          localStorage.removeItem('active_task_start');
        }
      }
    };

    initializeWorkspace();

    roomChannelRef.current = supabase.channel('study_room');
    roomChannelRef.current.subscribe();

    return () => {
      isMounted = false;
      clearInterval(timerRef.current);
      if (roomChannelRef.current) {
        roomChannelRef.current.untrack();
        supabase.removeChannel(roomChannelRef.current);
      }
    };
  }, []);

  // 🟢 GLOBAL PRESENCE TRACKER (Auto-updates without spamming network)
  useEffect(() => {
    if (!roomChannelRef.current || !userProfile?.username) return;

    if (activeTaskId) {
      const activeTask = currentState.current.todos.find(t => t.id === activeTaskId);
      roomChannelRef.current.track({ 
        username: userProfile.username, 
        task: activeTask ? activeTask.title : 'Deep Work' 
      });
    } else {
      roomChannelRef.current.untrack();
    }
  }, [activeTaskId, userProfile]);

  // 🕛 🔥 THE MIDNIGHT SPLITTER ENGINE 🔥
  useEffect(() => {
    const midnightChecker = setInterval(() => {
      const currentBDDate = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' });

      if (currentBDDate !== trueDateStr.current) {
        console.log("🕛 Midnight Crossed! Executing Silent Split...");
        const { habits: currHabits, todos: currTodos, studySeconds: currStudySecs, activeTaskId: currActiveTask } = currentState.current;

        let oldStudySecs = currStudySecs;
        let oldTodos = [...currTodos];

        if (currActiveTask && sessionStartRef.current) {
          const sessionSecs = Math.floor((Date.now() - sessionStartRef.current) / 1000);
          oldStudySecs += sessionSecs;
          oldTodos = oldTodos.map(t => t.id === currActiveTask ? { ...t, trackedSeconds: (t.trackedSeconds || 0) + sessionSecs } : t);
        }

        const saveOldDayData = async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const completedCount = oldTodos.filter(t => t.isDone).length;
            const payload = {
              user_id: session.user.id, date_str: trueDateStr.current, 
              water: currHabits.water, meal: currHabits.meal, prayer: currHabits.prayer,
              sleep: currHabits.sleepChecked, workout: currHabits.exerciseChecked,
              tasks_completed: completedCount, todos: oldTodos, study_seconds: oldStudySecs 
            };
            await supabase.from('daily_logs').upsert(payload, { onConflict: 'user_id, date_str' });
          } catch (error) {
            console.error("Midnight Sync Error:", error);
          }
        };
        saveOldDayData();

        trueDateStr.current = currentBDDate;
        setHabits({ water: 0, meal: 0, prayer: 0, sleepChecked: false, exerciseChecked: false });
        setTodos(oldTodos.map(t => ({ ...t, trackedSeconds: 0, isDone: false })));
        setStudySeconds(0);

        if (currActiveTask) {
          setLiveSeconds(0);
          const now = Date.now();
          sessionStartRef.current = now;
          localStorage.setItem('active_task_start', now); // Update local storage for new day
        }
      }
    }, 1000);

    return () => clearInterval(midnightChecker);
  }, []);

  const syncWorkspaceToSupabase = async (newHabits, newTodos, overrideStudySeconds = null) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const completedTasksCount = newTodos.filter(t => t.isDone).length;
      const finalStudySeconds = overrideStudySeconds !== null ? overrideStudySeconds : studySeconds;

      const payload = {
        user_id: session.user.id, date_str: trueDateStr.current, 
        water: newHabits.water, meal: newHabits.meal, prayer: newHabits.prayer,
        sleep: newHabits.sleepChecked, workout: newHabits.exerciseChecked,
        tasks_completed: completedTasksCount, todos: newTodos, study_seconds: finalStudySeconds 
      };
      await supabase.from('daily_logs').upsert(payload, { onConflict: 'user_id, date_str' });
    } catch (error) {
      console.error("Workspace Sync Error:", error);
    }
  };

  const handlePlay = (taskId) => {
    if (activeTaskId === taskId) return;
    if (activeTaskId) getSafePauseData(activeTaskId); 

    setActiveTaskId(taskId);
    setLiveSeconds(0);
    
    const now = Date.now();
    sessionStartRef.current = now;
    
    // 🔥 Save to Local Storage for Background Engine
    localStorage.setItem('active_task_id', taskId);
    localStorage.setItem('active_task_start', now);

    timerRef.current = setInterval(() => {
      const diff = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      setLiveSeconds(diff);
    }, 1000);
  };

  const getSafePauseData = (targetTaskId) => {
    let newStudySecs = studySeconds;
    let updatedTodos = [...todos];

    if (activeTaskId === targetTaskId) {
      clearInterval(timerRef.current);
      const sessionSecs = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      newStudySecs += sessionSecs;
      
      updatedTodos = updatedTodos.map(t => t.id === targetTaskId ? { ...t, trackedSeconds: (t.trackedSeconds || 0) + sessionSecs } : t);
      
      setStudySeconds(newStudySecs);
      setActiveTaskId(null);
      setLiveSeconds(0);
      sessionStartRef.current = null;

      // 🔥 Remove from Local Storage
      localStorage.removeItem('active_task_id');
      localStorage.removeItem('active_task_start');
    }
    return { newStudySecs, updatedTodos };
  };

  const handlePause = (taskId) => {
    if (activeTaskId !== taskId) return;
    const { newStudySecs, updatedTodos } = getSafePauseData(taskId);
    setTodos(updatedTodos);
    syncWorkspaceToSupabase(habits, updatedTodos, newStudySecs);
  };

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const updateHabit = (type, value, maxVal) => {
    const validValue = maxVal ? Math.min(Math.max(0, value), maxVal) : Math.max(0, value);
    const newHabits = { ...habits, [type]: validValue };
    setHabits(newHabits);
    syncWorkspaceToSupabase(newHabits, todos);
  };

  const handleAddAcademicTodo = () => {
    if (!selectedSubject || !selectedChapter || selectedActions.length === 0) return;
    const newTask = {
      id: Date.now(), type: 'academic', subjectKey: selectedSubject,
      subjectName: initialData.academics[selectedSubject].name, chapterIndex: selectedChapter,
      actions: selectedActions, title: `${initialData.academics[selectedSubject].chapters[selectedChapter]}`, 
      isDone: false, trackedSeconds: 0
    };
    const newTodos = [...todos, newTask];
    setTodos(newTodos);
    syncWorkspaceToSupabase(habits, newTodos);
    setSelectedChapter(''); setSelectedActions(['basic']);
  };

  const handleAddCustomTodo = () => {
    if (customTaskInput.trim() === "") return;
    const newTask = { id: Date.now(), type: 'custom', title: customTaskInput, actions: ['task'], isDone: false, trackedSeconds: 0 };
    const newTodos = [...todos, newTask];
    setTodos(newTodos);
    syncWorkspaceToSupabase(habits, newTodos);
    setCustomTaskInput("");
  };

  const toggleTodoDone = (id) => {
    const { newStudySecs, updatedTodos } = getSafePauseData(id); 
    const finalTodos = updatedTodos.map(todo => {
      if (todo.id === id) {
        const newDoneStatus = !todo.isDone;
        if (newDoneStatus && todo.type === 'academic') syncSyllabusFromTodo(todo.subjectKey, todo.chapterIndex, todo.actions);
        return { ...todo, isDone: newDoneStatus };
      }
      return todo;
    });
    setTodos(finalTodos);
    syncWorkspaceToSupabase(habits, finalTodos, newStudySecs);
  };

  const deleteTodo = (id) => {
    const { newStudySecs, updatedTodos } = getSafePauseData(id); 
    const finalTodos = updatedTodos.filter(t => t.id !== id);
    setTodos(finalTodos);
    syncWorkspaceToSupabase(habits, finalTodos, newStudySecs);
  };

  const toggleActionSelection = (action) => {
    setSelectedActions(prev => prev.includes(action) ? prev.filter(a => a !== action) : [...prev, action]);
  };

  const totalExpectedTasks = todos.length;
  const completedTasks = todos.filter(t => t.isDone).length;
  const progressPercent = totalExpectedTasks === 0 ? 0 : Math.round((completedTasks / totalExpectedTasks) * 100);

  if (loadingData) {
    return <div className="min-h-screen flex justify-center items-center text-[#10a37f] font-bold tracking-widest uppercase text-sm animate-pulse">Syncing Workspace...</div>;
  }

  return (
    <div className="pt-6 pb-24 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto space-y-6 px-2">
        
        {/* HEADER SECTION */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Focus Workspace</h1>
          <p className="text-slate-500 font-normal mt-2">Manage your tasks and build consistent habits.</p>
        </div>

        {/* PROGRESS BAR & BROADCASTING */}
        <div className="bg-sky-50/40 backdrop-blur-2xl border border-sky-100/60 shadow-sm rounded-3xl p-5 sm:p-6 transition-all duration-300">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="w-full md:w-1/2">
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-medium text-slate-600">Mission Progress</span>
                <span className="text-lg font-semibold text-[#10a37f]">{progressPercent}%</span>
              </div>
              <div className="h-2 w-full bg-sky-100 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-[#10a37f] transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            {activeTaskId && (
              <div className="flex items-center gap-3 bg-[#10a37f]/10 border border-[#10a37f]/20 px-4 py-2 rounded-xl shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10a37f] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10a37f]"></span>
                </span>
                <span className="text-xs font-medium text-[#10a37f] tracking-wide">Broadcasting Live</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* 🎯 ACTION ITEMS & INLINE TIMERS */}
          <div className="w-full lg:w-7/12 xl:w-8/12 space-y-4 order-1">
            <div className="bg-sky-50/40 backdrop-blur-2xl border border-sky-100/60 shadow-sm rounded-3xl p-5 sm:p-6 transition-all duration-300">
              
              <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-sky-100/50 pb-4">
                <h2 className="text-xl font-medium text-slate-800 flex items-center gap-2">
                  <Activity size={20} className="text-slate-400" /> Today's Missions
                </h2>
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-sky-100">
                  <button onClick={() => setTaskMode('academic')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${taskMode === 'academic' ? 'bg-[#10a37f] text-white' : 'text-slate-500 hover:text-slate-700'}`}>Academic</button>
                  <button onClick={() => setTaskMode('custom')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${taskMode === 'custom' ? 'bg-[#10a37f] text-white' : 'text-slate-500 hover:text-slate-700'}`}>Custom</button>
                </div>
              </div>

              {/* Input Section */}
              <div className="bg-white/60 border border-sky-50 rounded-2xl p-4 shadow-sm mb-6">
                {taskMode === 'academic' ? (
                  <div className="space-y-3">
                    <div className="flex bg-slate-100/80 p-1 rounded-xl shadow-inner border border-slate-200/50 w-full sm:w-fit">
                      <button onClick={() => setActiveGroup('science')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${activeGroup === 'science' ? 'bg-white shadow-sm text-[#10a37f]' : 'text-slate-500 hover:text-slate-700'}`}>
                        <GraduationCap size={14} /> Science
                      </button>
                      <button onClick={() => setActiveGroup('arts')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${activeGroup === 'arts' ? 'bg-white shadow-sm text-sky-500' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Palette size={14} /> Arts
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <select className="flex-1 bg-white border border-sky-100 rounded-xl px-3 py-2.5 text-sm font-normal text-slate-700 focus:outline-none focus:border-[#10a37f] transition-all" value={selectedSubject} onChange={(e) => { setSelectedSubject(e.target.value); setSelectedChapter(''); }}>
                        <option value="">Select Subject...</option>
                        {filteredSubjects.map(([key, subject]) => <option key={key} value={key}>{subject.name}</option>)}
                      </select>
                      <select className="flex-1 bg-white border border-sky-100 rounded-xl px-3 py-2.5 text-sm font-normal text-slate-700 focus:outline-none focus:border-[#10a37f] disabled:opacity-50 transition-all" value={selectedChapter} onChange={(e) => setSelectedChapter(e.target.value)} disabled={!selectedSubject}>
                        <option value="">Select Chapter...</option>
                        {selectedSubject && initialData.academics[selectedSubject].chapters.map((chapter, index) => <option key={index} value={index}>{chapter}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2 border-t border-sky-50">
                      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        {['basic', 'cq', 'mcq', 'mastered'].map(action => (
                          <button key={action} onClick={() => toggleActionSelection(action)} className={`px-3 py-1.5 text-xs font-medium uppercase tracking-wide rounded-lg transition-all shadow-sm ${selectedActions.includes(action) ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-700'}`}>{action}</button>
                        ))}
                      </div>
                      <button onClick={handleAddAcademicTodo} className="w-full sm:w-auto bg-[#10a37f] text-white px-5 py-2 rounded-xl hover:bg-[#0e8c6d] transition-all shadow-sm font-medium flex items-center justify-center gap-1.5 text-sm">
                        <Plus size={16} /> Add Task
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input type="text" value={customTaskInput} onChange={(e) => setCustomTaskInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTodo()} placeholder="Type a custom task..." className="flex-1 bg-white border border-sky-100 rounded-xl px-4 py-2.5 text-sm font-normal text-slate-700 focus:outline-none focus:border-[#10a37f] transition-all" />
                    <button onClick={handleAddCustomTodo} className="w-full sm:w-auto bg-[#10a37f] text-white px-5 py-2.5 rounded-xl font-medium hover:bg-[#0e8c6d] transition-all shadow-sm flex items-center justify-center gap-1.5 text-sm">
                      <Plus size={16} /> Add Task
                    </button>
                  </div>
                )}
              </div>

              {/* 🔥 TODO LIST */}
              <div className="space-y-3">
                {todos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 bg-white/40 rounded-2xl border border-dashed border-sky-200 text-slate-400">
                    <Activity size={24} className="mb-2 opacity-50" />
                    <p className="text-sm font-normal">Workspace is empty. Add a mission.</p>
                  </div>
                ) : (
                  todos.map(todo => {
                    const isRunning = activeTaskId === todo.id;
                    const displayTime = (todo.trackedSeconds || 0) + (isRunning ? liveSeconds : 0);

                    return (
                      <div key={todo.id} className={`bg-white border rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all duration-300 ${todo.isDone ? 'border-transparent bg-slate-50/50 opacity-70' : isRunning ? 'border-[#10a37f]/40 shadow-sm' : 'border-sky-50 hover:shadow-sm hover:border-sky-100'}`}>
                        
                        <div className="flex items-start md:items-center gap-3 flex-1 w-full">
                          <button onClick={() => toggleTodoDone(todo.id)} className={`mt-0.5 md:mt-0 w-5 h-5 flex-shrink-0 rounded-md border flex items-center justify-center transition-all duration-300 ${todo.isDone ? 'bg-green-500 border-green-500 text-white' : 'bg-transparent border-slate-300 hover:border-[#10a37f]'}`}>
                            {todo.isDone && <Check size={12} strokeWidth={3} />}
                          </button>
                          
                          <div className="flex-1">
                            {todo.type === 'academic' && (
                              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{todo.subjectName}</span>
                                {todo.actions.map(act => <span key={act} className="text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md uppercase tracking-wide">{act}</span>)}
                              </div>
                            )}
                            <span className={`text-sm font-normal transition-all ${todo.isDone ? 'line-through text-slate-400' : isRunning ? 'text-[#10a37f] font-medium' : 'text-slate-700'}`}>
                              {todo.title}
                            </span>
                          </div>
                        </div>

                        {/* Timer Controls */}
                        <div className="flex items-center justify-between md:justify-end w-full md:w-auto mt-2 md:mt-0 pl-8 md:pl-0 gap-3">
                          <div className={`font-mono text-sm tracking-tight tabular-nums font-medium px-2.5 py-1 rounded-lg border ${isRunning ? 'text-[#10a37f] bg-[#10a37f]/10 border-[#10a37f]/20' : 'text-slate-500 bg-slate-50 border-slate-100'}`}>
                            {formatTime(displayTime)}
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            {!todo.isDone && (
                              isRunning ? (
                                <button onClick={() => handlePause(todo.id)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-all border border-rose-100">
                                  <Pause size={16} className="fill-current" />
                                </button>
                              ) : (
                                <button onClick={() => handlePlay(todo.id)} className="p-1.5 bg-sky-50 text-sky-600 rounded-lg hover:bg-sky-100 transition-all border border-sky-100">
                                  <Play size={16} className="fill-current ml-0.5" />
                                </button>
                              )
                            )}
                            <button onClick={() => deleteTodo(todo.id)} className={`p-1.5 rounded-lg transition-all ${todo.isDone ? 'text-slate-300 hover:text-red-500 hover:bg-red-50' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* 💪 PHYSICAL CORE */}
          <div className="w-full lg:w-5/12 xl:w-4/12 order-2">
            <div className="bg-sky-50/40 backdrop-blur-2xl border border-sky-100/60 shadow-sm rounded-3xl p-5 sm:p-6 transition-all duration-300">
              <h2 className="text-xl font-medium text-slate-800 flex items-center gap-2 mb-6 border-b border-sky-100/50 pb-4">
                <Activity size={20} className="text-slate-400" /> Physical Core
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                {/* Hydration */}
                <div className="bg-white border border-sky-50 rounded-2xl p-4 shadow-sm hover:border-sky-100 transition-all">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <Droplets size={16} className="text-sky-500" />
                      <span className="text-sm font-medium text-slate-700">Hydration</span>
                    </div>
                    <span className="text-xs font-medium text-slate-400">{habits.water}/12</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-between">
                    {Array.from({ length: 12 }).map((_, i) => {
                      const isFilled = i < habits.water;
                      return (
                        <button key={i} disabled={isFilled} onClick={() => updateHabit('water', habits.water + 1, 12)}
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all border ${isFilled ? 'bg-[#10a37f] border-[#10a37f] text-white' : 'bg-slate-50 border-slate-200 hover:border-[#10a37f] cursor-pointer'}`}>
                          {isFilled && <Check size={12} strokeWidth={3} />}
                        </button>
                      )
                    })}
                  </div>
                </div>
                
                {/* Nutrition */}
                <div className="bg-white border border-sky-50 rounded-2xl p-4 shadow-sm hover:border-sky-100 transition-all">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <Utensils size={16} className="text-orange-500" />
                      <span className="text-sm font-medium text-slate-700">Nutrition</span>
                    </div>
                    <span className="text-xs font-medium text-slate-400">{habits.meal}/4</span>
                  </div>
                  <div className="flex gap-2">
                    {Array.from({ length: 4 }).map((_, i) => {
                      const isFilled = i < habits.meal;
                      return (
                        <button key={i} disabled={isFilled} onClick={() => updateHabit('meal', habits.meal + 1, 4)}
                          className={`flex-1 h-8 rounded-lg flex items-center justify-center transition-all border ${isFilled ? 'bg-[#10a37f] border-[#10a37f] text-white' : 'bg-slate-50 border-slate-200 hover:border-[#10a37f] cursor-pointer'}`}>
                          {isFilled && <Check size={14} strokeWidth={3} />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Prayer */}
                <div className="bg-white border border-sky-50 rounded-2xl p-4 shadow-sm hover:border-sky-100 transition-all">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <BookOpen size={16} className="text-indigo-500" />
                      <span className="text-sm font-medium text-slate-700">Prayer</span>
                    </div>
                    <span className="text-xs font-medium text-slate-400">{habits.prayer}/5</span>
                  </div>
                  <div className="flex gap-2 justify-between">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const isFilled = i < habits.prayer;
                      return (
                        <button key={i} disabled={isFilled} onClick={() => updateHabit('prayer', habits.prayer + 1, 5)}
                          className={`flex-1 h-8 rounded-lg flex items-center justify-center transition-all border ${isFilled ? 'bg-[#10a37f] border-[#10a37f] text-white' : 'bg-slate-50 border-slate-200 hover:border-[#10a37f] cursor-pointer'}`}>
                          {isFilled && <Check size={14} strokeWidth={3} />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Sleep & Workout */}
                <div className="bg-white border border-sky-50 rounded-2xl p-4 shadow-sm hover:border-sky-100 transition-all flex flex-col gap-4">
                  <button disabled={habits.sleepChecked} onClick={() => updateHabit('sleepChecked', true)} className="flex justify-between items-center cursor-pointer group text-left w-full disabled:cursor-default">
                    <div className="flex items-center gap-2.5">
                      <Moon size={16} className="text-violet-500" />
                      <span className={`text-sm font-normal transition-colors ${habits.sleepChecked ? 'text-slate-400' : 'text-slate-700 group-hover:text-violet-600'}`}>Sleep (7 Hrs)</span>
                    </div>
                    <div className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center ${habits.sleepChecked ? 'bg-green-500 border-green-500 text-white' : 'bg-slate-50 border-slate-300 group-hover:border-[#10a37f]'}`}>
                      {habits.sleepChecked && <Check size={12} strokeWidth={3} />}
                    </div>
                  </button>
                  <div className="h-px w-full bg-slate-100"></div>
                  <button disabled={habits.exerciseChecked} onClick={() => updateHabit('exerciseChecked', true)} className="flex justify-between items-center cursor-pointer group text-left w-full disabled:cursor-default">
                    <div className="flex items-center gap-2.5">
                      <Activity size={16} className="text-rose-500" />
                      <span className={`text-sm font-normal transition-colors ${habits.exerciseChecked ? 'text-slate-400' : 'text-slate-700 group-hover:text-rose-600'}`}>Workout (30 Min)</span>
                    </div>
                    <div className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center ${habits.exerciseChecked ? 'bg-green-500 border-green-500 text-white' : 'bg-slate-50 border-slate-300 group-hover:border-[#10a37f]'}`}>
                      {habits.exerciseChecked && <Check size={12} strokeWidth={3} />}
                    </div>
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}