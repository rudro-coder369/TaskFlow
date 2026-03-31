import React, { useState, useContext, useEffect, useRef } from 'react';
import { initialData } from '../data/initialData';
import { Droplets, Utensils, Moon, Activity, BookOpen, Plus, Check, Trash2, Play, Pause, GraduationCap, Palette, Users, Trophy } from 'lucide-react';
import { ProgressContext } from '../App';
import { supabase } from '../services/supabase';

export default function TimerScreen() {
  const { syncSyllabusFromTodo } = useContext(ProgressContext);

  const [habits, setHabits] = useState({ water: 0, meal: 0, prayer: 0, sleepChecked: false, exerciseChecked: false });
  const [todos, setTodos] = useState([]);
  
  const [studySeconds, setStudySeconds] = useState(0); 
  const [selfStudySeconds, setSelfStudySeconds] = useState(0); 
  const [classSeconds, setClassSeconds] = useState(0); 
  const [loadingData, setLoadingData] = useState(true);
  
  const [taskMode, setTaskMode] = useState('academic'); 
  const [activeGroup, setActiveGroup] = useState(() => localStorage.getItem('academic_group') || 'science');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedActions, setSelectedActions] = useState(['basic']); 
  const [customTaskInput, setCustomTaskInput] = useState("");
  const [newTaskStudyType, setNewTaskStudyType] = useState('self'); 

  const [activeTaskId, setActiveTaskId] = useState(null);
  
  // 🛡️ SAFEGURADS & REFS
  const timerRef = useRef(null);
  const sessionStartRef = useRef(null);
  const isProcessingRef = useRef(false);
  const isMidnightProcessing = useRef(false);
  
  // 🕒 BASE REFS (To track values before the current session started)
  const baseSecondsRef = useRef({ study: 0, self: 0, cls: 0, taskBase: 0 });

  const [syncPopupTask, setSyncPopupTask] = useState(null); 
  const [milestonePopup, setMilestonePopup] = useState(null); 
  const [dailyMilestones, setDailyMilestones] = useState({ targets: [], reached: [] });
  const [onlineUsers, setOnlineUsers] = useState([]);
  const trueDateStr = useRef(new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' }));

  const currentState = useRef({ habits, todos, studySeconds, selfStudySeconds, classSeconds, activeTaskId, dailyMilestones });
  useEffect(() => {
    currentState.current = { habits, todos, studySeconds, selfStudySeconds, classSeconds, activeTaskId, dailyMilestones };
  }, [habits, todos, studySeconds, selfStudySeconds, classSeconds, activeTaskId, dailyMilestones]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") Notification.requestPermission();
  }, []);

  // 🚀 OFFLINE QUEUE
  const processOfflineQueue = async () => {
    const queueStr = localStorage.getItem('offline_sync_queue');
    if (!queueStr) return;
    try {
      const queue = JSON.parse(queueStr);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        for (const payload of queue) await supabase.from('daily_logs').upsert(payload, { onConflict: 'user_id, date_str' });
        localStorage.removeItem('offline_sync_queue');
      }
    } catch (e) {}
  };

  // 🚀 LIVE ROOM
  const fetchLiveUsers = async () => {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase.from('profiles').select('username, active_task').not('active_task', 'is', null).gte('task_expires_at', nowIso); 
    if (data && !error) setOnlineUsers(data.map(u => ({ username: u.username, task: u.active_task })));
  };

  useEffect(() => {
    fetchLiveUsers();
    const dbLiveRoomSub = supabase.channel('live_room_db').on('postgres', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => fetchLiveUsers()).subscribe();
    return () => supabase.removeChannel(dbLiveRoomSub);
  }, []);

  // 🎲 MILESTONES
  useEffect(() => {
    const today = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' });
    const savedMilestones = JSON.parse(localStorage.getItem('lucky_milestones') || '{}');
    if (savedMilestones.date !== today) {
      const t1 = Math.floor(Math.random() * (7200 - 3600 + 1) + 3600); const t2 = Math.floor(Math.random() * (14400 - 10800 + 1) + 10800); const t3 = Math.floor(Math.random() * (25200 - 18000 + 1) + 18000); 
      const newMilestones = { date: today, targets: [t1, t2, t3], reached: [] };
      localStorage.setItem('lucky_milestones', JSON.stringify(newMilestones)); setDailyMilestones(newMilestones);
    } else setDailyMilestones(savedMilestones);
  }, []);

  // 🛠️ THE ABSOLUTE TIMER ENGINE (Fixed 2x speed & Background issues)
  const startTimerInterval = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      if (!sessionStartRef.current || !currentState.current.activeTaskId || isMidnightProcessing.current) return;

      const currentNow = Date.now();
      const elapsed = Math.floor((currentNow - sessionStartRef.current) / 1000); // Pure elapsed time
      
      const { todos: currTodos, activeTaskId: currTaskId, dailyMilestones: currMilestones, habits: currHabits } = currentState.current;
      const activeTask = currTodos.find(t => t.id === currTaskId);
      const sType = activeTask?.studyType || 'self';

      // 🕒 CALCULATE ABSOLUTE TOTALS (Base + Elapsed)
      const newStudyTotal = baseSecondsRef.current.study + elapsed;
      const newSelfTotal = baseSecondsRef.current.self + (sType === 'self' ? elapsed : 0);
      const newClassTotal = baseSecondsRef.current.cls + (sType === 'class' ? elapsed : 0);
      const newTaskTracked = baseSecondsRef.current.taskBase + elapsed;

      // Update State (1x Speed Guaranteed)
      setStudySeconds(newStudyTotal);
      setSelfStudySeconds(newSelfTotal);
      setClassSeconds(newClassTotal);
      setTodos(prev => prev.map(t => t.id === currTaskId ? { ...t, trackedSeconds: newTaskTracked } : t));

      // Milestone Check
      currMilestones.targets.forEach((target) => {
        if (newStudyTotal >= target && !currMilestones.reached.includes(target)) {
          const newReached = [...currMilestones.reached, target];
          setDailyMilestones(prev => ({ ...prev, reached: newReached }));
          localStorage.setItem('lucky_milestones', JSON.stringify({ ...currMilestones, reached: newReached }));
          setMilestonePopup(target);
        }
      });

      // DB Sync every 60s
      if (elapsed > 0 && elapsed % 60 === 0) {
        const updatedTodos = currTodos.map(t => t.id === currTaskId ? { ...t, trackedSeconds: newTaskTracked } : t);
        syncWorkspaceToSupabase(currHabits, updatedTodos, newStudyTotal, newSelfTotal, newClassTotal);
      }

      // 🛑 2 HOURS LIMIT
      if (elapsed >= 7200) {
        handlePause(currTaskId);
        try { new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg').play(); } catch(e) {}
        if ("Notification" in window && Notification.permission === "granted") new Notification("⏳ Focus Limit Reached!", { body: "You've studied for 2 hours. Take a break!", icon: "/favicon.ico" });
        else alert("⏳ Focus limit reached!");
      }
    }, 1000);
  };

  const syncWorkspaceToSupabase = async (newHabits, newTodos, overrideStudy = null, overrideSelf = null, overrideClass = null) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const payload = {
        user_id: session.user.id, date_str: trueDateStr.current, water: newHabits.water, meal: newHabits.meal, prayer: newHabits.prayer,
        sleep: newHabits.sleepChecked, workout: newHabits.exerciseChecked, tasks_completed: newTodos.filter(t => t.isDone).length, todos: newTodos, 
        study_seconds: overrideStudy ?? studySeconds, self_study_seconds: overrideSelf ?? selfStudySeconds, class_seconds: overrideClass ?? classSeconds
      };
      const { error } = await supabase.from('daily_logs').upsert(payload, { onConflict: 'user_id, date_str' });
      if (!error) processOfflineQueue();
    } catch (e) {}
  };

  // 🔄 RECOVERY & NAVIGATION SYNC
  useEffect(() => {
    let isMounted = true;
    const initializeWorkspace = async () => {
      try {
        const res = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=Asia/Dhaka');
        if (res.ok) {
          const data = await res.json();
          trueDateStr.current = new Date(data.dateTime + "+06:00").toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' });
        }
      } catch (err) {}

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.from('daily_logs').select('*').eq('user_id', session.user.id).eq('date_str', trueDateStr.current).single();

      let fHabits = { water: 0, meal: 0, prayer: 0, sleepChecked: false, exerciseChecked: false };
      let fTodos = []; let fStudy = 0; let fSelf = 0; let fClass = 0;

      if (data && !error) {
        fHabits = { water: data.water || 0, meal: data.meal || 0, prayer: data.prayer || 0, sleepChecked: data.sleep || false, exerciseChecked: data.workout || false };
        fTodos = data.todos || []; fStudy = parseInt(data.study_seconds || 0); fSelf = parseInt(data.self_study_seconds || 0); fClass = parseInt(data.class_seconds || 0);
      }

      // Check if a timer was already running in another screen/tab
      const savedTaskId = localStorage.getItem('active_task_id');
      const savedStart = localStorage.getItem('active_task_start');

      if (savedTaskId && savedStart && isMounted) {
        const startMs = Number(savedStart);
        const elapsed = Math.floor((Date.now() - startMs) / 1000);
        
        if (elapsed < 7200) {
          const task = fTodos.find(t => t.id === Number(savedTaskId));
          const sType = task?.studyType || 'self';
          
          // Set Base Refs for continuous counting
          baseSecondsRef.current = { study: fStudy, self: fSelf, cls: fClass, taskBase: task?.trackedSeconds || 0 };
          sessionStartRef.current = startMs;
          setActiveTaskId(Number(savedTaskId));
          startTimerInterval();
        } else {
          localStorage.removeItem('active_task_id'); localStorage.removeItem('active_task_start'); localStorage.removeItem('active_task_title');
          window.dispatchEvent(new Event('presence_update'));
        }
      }

      setHabits(fHabits); setTodos(fTodos); setStudySeconds(fStudy); setSelfStudySeconds(fSelf); setClassSeconds(fClass); setLoadingData(false);
    };

    initializeWorkspace();
    return () => { isMounted = false; clearInterval(timerRef.current); };
  }, []);

  // 🌙 MIDNIGHT SPLITTER
  useEffect(() => {
    const midnightChecker = setInterval(() => {
      const currentBDDate = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' });
      if (currentBDDate !== trueDateStr.current) {
        isMidnightProcessing.current = true;
        const current = currentState.current;
        const now = Date.now();
        const elapsed = sessionStartRef.current ? Math.floor((now - sessionStartRef.current) / 1000) : 0;
        
        // Final Save for yesterday
        syncWorkspaceToSupabase(current.habits, current.todos, current.studySeconds, current.selfStudySeconds, current.classSeconds);
        
        trueDateStr.current = currentBDDate;
        setHabits({ water: 0, meal: 0, prayer: 0, sleepChecked: false, exerciseChecked: false });
        setTodos(prev => prev.map(t => ({ ...t, trackedSeconds: 0, isDone: false })));
        setStudySeconds(0); setSelfStudySeconds(0); setClassSeconds(0);
        
        if (current.activeTaskId) {
          sessionStartRef.current = now;
          baseSecondsRef.current = { study: 0, self: 0, cls: 0, taskBase: 0 };
          localStorage.setItem('active_task_start', now.toString());
        }
        isMidnightProcessing.current = false;
      }
    }, 1000);
    return () => clearInterval(midnightChecker);
  }, []);

  const handlePlay = async (taskId) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    if (activeTaskId) {
      // If switching tasks, pause current first
      await getSafePauseData(activeTaskId);
    }

    const now = Date.now();
    const task = currentState.current.todos.find(t => t.id === taskId);
    
    // Set Bases
    baseSecondsRef.current = { 
      study: currentState.current.studySeconds, 
      self: currentState.current.selfStudySeconds, 
      cls: currentState.current.classSeconds, 
      taskBase: task?.trackedSeconds || 0 
    };

    sessionStartRef.current = now;
    setActiveTaskId(taskId);
    localStorage.setItem('active_task_id', taskId.toString());
    localStorage.setItem('active_task_start', now.toString());
    localStorage.setItem('active_task_title', task?.title || "Focusing");
    
    window.dispatchEvent(new Event('presence_update'));
    startTimerInterval();
    
    // Instant DB Presence
    const expiresAt = new Date(now + 7200 * 1000).toISOString();
    supabase.from('profiles').update({ active_task: task?.title, task_expires_at: expiresAt }).eq('id', (await supabase.auth.getUser()).data.user.id).then();

    setTimeout(() => { isProcessingRef.current = false; }, 600);
  };

  const getSafePauseData = async (id) => {
    clearInterval(timerRef.current);
    const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
    
    const current = currentState.current;
    const task = current.todos.find(t => t.id === id);
    const sType = task?.studyType || 'self';

    const finalStudy = baseSecondsRef.current.study + elapsed;
    const finalSelf = baseSecondsRef.current.self + (sType === 'self' ? elapsed : 0);
    const finalClass = baseSecondsRef.current.cls + (sType === 'class' ? elapsed : 0);
    const finalTaskSecs = baseSecondsRef.current.taskBase + elapsed;

    const updatedTodos = current.todos.map(t => t.id === id ? { ...t, trackedSeconds: finalTaskSecs } : t);
    
    setStudySeconds(finalStudy); setSelfStudySeconds(finalSelf); setClassSeconds(finalClass); setTodos(updatedTodos);
    setActiveTaskId(null); sessionStartRef.current = null;

    localStorage.removeItem('active_task_id'); localStorage.removeItem('active_task_start'); localStorage.removeItem('active_task_title');
    window.dispatchEvent(new Event('presence_update'));

    await syncWorkspaceToSupabase(current.habits, updatedTodos, finalStudy, finalSelf, finalClass);
    supabase.from('profiles').update({ active_task: null, task_expires_at: null }).eq('id', (await supabase.auth.getUser()).data.user.id).then();
  };

  const handlePause = (taskId) => {
    if (isProcessingRef.current || activeTaskId !== taskId) return;
    isProcessingRef.current = true;
    getSafePauseData(taskId).then(() => { isProcessingRef.current = false; });
  };

  // UI HELPERS
  const formatTime = (s) => {
    const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60;
    return h > 0 ? `${h}h ${m}m ${sec}s` : `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const updateHabit = (type, val, max) => {
    const newHabits = { ...habits, [type]: max ? Math.min(Math.max(0, val), max) : val };
    setHabits(newHabits); syncWorkspaceToSupabase(newHabits, todos);
  };

  const handleAddAcademicTodo = () => {
    if (!selectedSubject || selectedChapter === '' || selectedActions.length === 0) return;
    const newTask = { id: Date.now(), type: 'academic', studyType: newTaskStudyType, subjectKey: selectedSubject, subjectName: initialData.academics[selectedSubject].name, chapterIndex: selectedChapter, actions: selectedActions, title: initialData.academics[selectedSubject].chapters[selectedChapter], isDone: false, trackedSeconds: 0 };
    const newTodos = [...todos, newTask]; setTodos(newTodos); syncWorkspaceToSupabase(habits, newTodos);
    setSelectedChapter(''); setSelectedActions(['basic']);
  };

  const handleAddCustomTodo = () => {
    if (!customTaskInput.trim()) return;
    const newTask = { id: Date.now(), type: 'custom', studyType: newTaskStudyType, title: customTaskInput, actions: ['task'], isDone: false, trackedSeconds: 0 };
    const newTodos = [...todos, newTask]; setTodos(newTodos); syncWorkspaceToSupabase(habits, newTodos); setCustomTaskInput("");
  };

  const handleTodoCheckClick = (todo) => {
    if (!todo.isDone && todo.type === 'academic') setSyncPopupTask(todo);
    else processTodoStatus(todo.id, false, !todo.isDone);
  };

  const processTodoStatus = async (id, shouldSync, status) => {
    if (activeTaskId === id) await getSafePauseData(id);
    setTodos(prev => {
      const updated = prev.map(t => {
        if (t.id === id) {
          if (shouldSync && t.type === 'academic') syncSyllabusFromTodo(t.subjectKey, t.chapterIndex, t.actions);
          return { ...t, isDone: status };
        }
        return t;
      });
      syncWorkspaceToSupabase(habits, updated);
      return updated;
    });
    setSyncPopupTask(null);
  };

  const deleteTodo = async (id) => {
    if (activeTaskId === id) await getSafePauseData(id);
    const updated = todos.filter(t => t.id !== id);
    setTodos(updated); syncWorkspaceToSupabase(habits, updated);
  };

  const toggleActionSelection = (a) => setSelectedActions(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  const formatName = (n) => n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : "Scholar";
  const getAvailableActions = (s) => {
    if (!s) return ['basic', 'cq', 'mcq', 'mastered'];
    const k = s.toLowerCase();
    if (k.includes('english') || k.includes('ict')) return ['basic', 'mastered'];
    if (k.includes('bangla_2nd')) return ['basic', 'mcq', 'mastered'];
    return ['basic', 'cq', 'mcq', 'mastered'];
  };

  const progressPercent = todos.length ? Math.round((todos.filter(t => t.isDone).length / todos.length) * 100) : 0;

  if (loadingData) return <div className="min-h-screen flex justify-center items-center text-[#10a37f] font-bold tracking-widest uppercase text-xs animate-pulse">Syncing Workspace...</div>;

  return (
    <div className="pt-6 pb-24 font-sans text-slate-800 relative">
      {milestonePopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-transparent animate-in fade-in duration-300">
          <div className="bg-[#10a37f]/95 backdrop-blur-3xl rounded-[2rem] p-8 shadow-2xl max-w-sm w-full border border-[#0e8c6d] text-center text-white">
            <Trophy size={48} className="mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">Milestone Unlocked!</h3>
            <p className="mb-6 opacity-90">Great job staying consistent. 🚀</p>
            <button onClick={() => setMilestonePopup(null)} className="w-full py-3 rounded-xl font-bold text-[#10a37f] bg-white">Awesome!</button>
          </div>
        </div>
      )}

      {syncPopupTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-transparent animate-in fade-in duration-200">
          <div className="bg-sky-50/95 backdrop-blur-3xl rounded-[2rem] p-6 shadow-2xl max-w-sm w-full border border-sky-200">
            <div className="flex items-center gap-3 mb-5">
              <BookOpen size={24} className="text-sky-500" />
              <h3 className="text-xl font-bold">Update Syllabus?</h3>
            </div>
            <div className="bg-white/70 p-4 rounded-2xl mb-6 shadow-sm">
              <p className="text-[15px] font-semibold">{syncPopupTask.title}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => processTodoStatus(syncPopupTask.id, false, true)} className="flex-1 py-3 rounded-xl text-sm font-semibold bg-white border">No</button>
              <button onClick={() => processTodoStatus(syncPopupTask.id, true, true)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-[#10a37f]">Yes, update</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6 px-3">
        <div className="text-center mb-8"><h1 className="text-3xl font-semibold">Your Study Workspace</h1></div>

        {/* 🔴 LIVE ROOM */}
        <div className="bg-sky-50/40 backdrop-blur-2xl border border-sky-100 shadow-sm rounded-3xl p-5">
          <h2 className="text-xl font-medium flex items-center justify-between mb-4 pb-4 border-b border-sky-100">
            <div className="flex items-center gap-2"><Users size={20} className="text-sky-500" /> Live Study Room</div>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{onlineUsers.length} Active</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {onlineUsers.map((u, i) => (
              <div key={i} className="bg-white border border-sky-50 p-3 rounded-2xl flex items-center gap-3 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-[#10a37f] text-white flex items-center justify-center font-bold">{u.username[0].toUpperCase()}</div>
                <div className="min-w-0"><p className="text-xs font-semibold truncate">{formatName(u.username)}</p><p className="text-[10px] text-[#10a37f] truncate">Studying: {u.task}</p></div>
              </div>
            ))}
          </div>
        </div>

        {/* 📊 PROGRESS */}
        <div className="bg-sky-50/40 border border-sky-100 shadow-sm rounded-3xl p-5">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="w-full md:w-1/2">
              <div className="flex justify-between items-end mb-2"><span className="text-sm font-medium">Daily Task Progress</span><span className="text-lg font-semibold text-[#10a37f]">{progressPercent}%</span></div>
              <div className="h-2 w-full bg-sky-100 rounded-full overflow-hidden"><div className="h-full bg-[#10a37f] transition-all duration-1000" style={{ width: `${progressPercent}%` }} /></div>
              <div className="flex justify-between mt-3 text-[11px] font-bold text-slate-500">
                <span>Self Study: {formatTime(selfStudySeconds)}</span><span>Online Class: {formatTime(classSeconds)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 🎯 MISSIONS */}
        <div className="bg-sky-50/40 border border-sky-100 rounded-3xl p-5">
          <div className="flex justify-between mb-6 pb-4 border-b border-sky-100">
            <h2 className="text-xl font-medium">Your Tasks</h2>
            <div className="flex bg-white p-1 rounded-xl shadow-sm">
              <button onClick={() => setTaskMode('academic')} className={`px-4 py-1.5 rounded-lg text-sm transition-all ${taskMode === 'academic' ? 'bg-[#10a37f] text-white' : 'text-slate-500'}`}>Academic</button>
              <button onClick={() => setTaskMode('custom')} className={`px-4 py-1.5 rounded-lg text-sm transition-all ${taskMode === 'custom' ? 'bg-[#10a37f] text-white' : 'text-slate-500'}`}>Custom</button>
            </div>
          </div>

          <div className="bg-white/60 p-4 rounded-2xl shadow-sm mb-6 border border-sky-50">
            <div className="flex gap-2 mb-4 pb-4 border-b border-sky-50">
              <button onClick={() => setNewTaskStudyType('self')} className={`px-4 py-1.5 rounded-lg text-xs font-bold border ${newTaskStudyType === 'self' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white text-slate-500'}`}>Self Study</button>
              <button onClick={() => setNewTaskStudyType('class')} className={`px-4 py-1.5 rounded-lg text-xs font-bold border ${newTaskStudyType === 'class' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-slate-500'}`}>Online Class</button>
            </div>

            {taskMode === 'academic' ? (
              <div className="space-y-3">
                <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                  <button onClick={() => setActiveGroup('science')} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${activeGroup === 'science' ? 'bg-white text-[#10a37f]' : 'text-slate-500'}`}>Science</button>
                  <button onClick={() => setActiveGroup('arts')} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${activeGroup === 'arts' ? 'bg-white text-sky-500' : 'text-slate-500'}`}>Arts</button>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select className="flex-1 bg-white border border-sky-100 rounded-xl px-3 py-2 text-sm" value={selectedSubject} onChange={(e) => { setSelectedSubject(e.target.value); setSelectedChapter(''); }}>
                    <option value="">Subject...</option>{filteredSubjects.map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
                  </select>
                  <select className="flex-1 bg-white border border-sky-100 rounded-xl px-3 py-2 text-sm" value={selectedChapter} onChange={(e) => setSelectedChapter(e.target.value)} disabled={!selectedSubject}>
                    <option value="">Chapter...</option>{selectedSubject && initialData.academics[selectedSubject].chapters.map((c, i) => <option key={i} value={i}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {getAvailableActions(selectedSubject).map(a => (<button key={a} onClick={() => toggleActionSelection(a)} className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg border ${selectedActions.includes(a) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white text-slate-400'}`}>{a}</button>))}
                  <button onClick={handleAddAcademicTodo} className="ml-auto bg-[#10a37f] text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm">Add Task</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <input type="text" value={customTaskInput} onChange={(e) => setCustomTaskInput(e.target.value)} placeholder="Personal task..." className="flex-1 bg-white border border-sky-100 rounded-xl px-4 py-2 text-sm" />
                <button onClick={handleAddCustomTodo} className="bg-[#10a37f] text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm">Add Task</button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {todos.map(t => (
              <div key={t.id} className={`bg-white border rounded-2xl p-4 flex justify-between items-center transition-all ${t.isDone ? 'opacity-50 grayscale' : activeTaskId === t.id ? 'border-[#10a37f] shadow-md' : 'border-sky-50'}`}>
                <div className="flex items-center gap-3">
                  <button onClick={() => handleTodoCheckClick(t)} className={`w-5 h-5 rounded border flex items-center justify-center ${t.isDone ? 'bg-green-500 border-green-500 text-white' : ''}`}>{t.isDone && <Check size={12} />}</button>
                  <div>
                    <div className="flex gap-2 text-[8px] font-bold uppercase mb-1">
                       <span className={t.studyType === 'class' ? 'text-indigo-500' : 'text-[#10a37f]'}>{t.studyType}</span>
                       {t.type === 'academic' && <span className="text-slate-400">{t.subjectName}</span>}
                    </div>
                    <p className={`text-sm ${t.isDone ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>{t.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100">{formatTime(t.trackedSeconds)}</span>
                  {!t.isDone && (activeTaskId === t.id ? <button onClick={() => handlePause(t.id)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><Pause size={16} /></button> : <button onClick={() => handlePlay(t.id)} className="p-1.5 bg-sky-50 text-sky-600 rounded-lg"><Play size={16} /></button>)}
                  <button onClick={() => deleteTodo(t.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 💪 HABITS */}
        <div className="bg-sky-50/40 border border-sky-100 rounded-3xl p-5">
          <h2 className="text-xl font-medium mb-6 pb-4 border-b border-sky-100">Health Habits</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-sky-50 p-4 rounded-2xl">
               <div className="flex justify-between mb-3 text-xs font-bold"><span>Water</span><span>{habits.water}/12</span></div>
               <div className="flex flex-wrap gap-1">
                 {Array.from({ length: 12 }).map((_, i) => (
                   <button key={i} onClick={() => updateHabit('water', habits.water + 1, 12)} className={`w-6 h-6 rounded-full border text-white flex items-center justify-center ${i < habits.water ? 'bg-[#10a37f] border-[#10a37f]' : 'bg-slate-50'}`}>{i < habits.water && <Check size={10} />}</button>
                 ))}
               </div>
            </div>
            <div className="bg-white border border-sky-50 p-4 rounded-2xl flex flex-col gap-3">
               <button onClick={() => updateHabit('sleepChecked', true)} className="flex justify-between text-sm font-medium"><span>Sleep 7h+</span><div className={`w-5 h-5 border rounded ${habits.sleepChecked ? 'bg-green-500 text-white' : ''}`}>{habits.sleepChecked && <Check size={12} />}</div></button>
               <button onClick={() => updateHabit('exerciseChecked', true)} className="flex justify-between text-sm font-medium"><span>Exercise</span><div className={`w-5 h-5 border rounded ${habits.exerciseChecked ? 'bg-green-500 text-white' : ''}`}>{habits.exerciseChecked && <Check size={12} />}</div></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}