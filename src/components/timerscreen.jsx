import React, { useState, useContext, useEffect, useRef } from 'react';
import { initialData } from '../data/initialData';
import { Droplets, Utensils, Moon, Activity, BookOpen, Plus, Check, Trash2, Play, Pause, GraduationCap, Palette, Users, Trophy } from 'lucide-react';
import { ProgressContext } from '../App';
import { supabase } from '../services/supabase';

export default function TimerScreen() {
  const { syncSyllabusFromTodo } = useContext(ProgressContext);

  const [habits, setHabits] = useState({ water: 0, meal: 0, prayer: 0, sleepChecked: false, exerciseChecked: false });
  const [todos, setTodos] = useState([]);
  
  // 🕒 TIMERS
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
  
  // 📚 STUDY TYPE SELECTION
  const [newTaskStudyType, setNewTaskStudyType] = useState('self'); 

  const [activeTaskId, setActiveTaskId] = useState(null);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const timerRef = useRef(null);
  const sessionStartRef = useRef(null);

  // 🌟 POPUP STATES
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
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, []);

  // 🚀 1. DATABASE LIVE ROOM LOGIC
  const fetchLiveUsers = async () => {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('profiles')
      .select('username, active_task')
      .not('active_task', 'is', null)
      .gte('task_expires_at', nowIso); 

    if (data && !error) {
      setOnlineUsers(data.map(u => ({ username: u.username, task: u.active_task })));
    }
  };

  useEffect(() => {
    fetchLiveUsers();
    const dbLiveRoomSub = supabase.channel('live_room_db')
      .on('postgres', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => fetchLiveUsers())
      .subscribe();

    return () => supabase.removeChannel(dbLiveRoomSub);
  }, []);

  // 🎲 2. GENERATE LUCKY MILESTONES
  useEffect(() => {
    const today = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' });
    const savedMilestones = JSON.parse(localStorage.getItem('lucky_milestones') || '{}');

    if (savedMilestones.date !== today) {
      const t1 = Math.floor(Math.random() * (7200 - 3600 + 1) + 3600); 
      const t2 = Math.floor(Math.random() * (14400 - 10800 + 1) + 10800); 
      const t3 = Math.floor(Math.random() * (25200 - 18000 + 1) + 18000); 
      const newMilestones = { date: today, targets: [t1, t2, t3], reached: [] };
      localStorage.setItem('lucky_milestones', JSON.stringify(newMilestones));
      setDailyMilestones(newMilestones);
    } else {
      setDailyMilestones(savedMilestones);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('academic_group', activeGroup);
    setSelectedSubject(''); setSelectedChapter(''); setSelectedActions(['basic']); 
  }, [activeGroup]);

  const filteredSubjects = Object.entries(initialData.academics).filter(([key, data]) => data.groups && data.groups.includes(activeGroup));

  // 🛠️ TIMER INTERVAL WITH 60s AUTO-SYNC
  const startTimerInterval = (startStrTime) => {
    timerRef.current = setInterval(() => {
      const currentNow = Date.now();
      const diff = Math.floor((currentNow - startStrTime) / 1000);
      
      const { todos: currTodos, studySeconds: currStudySecs, selfStudySeconds: currSelf, classSeconds: currClass, activeTaskId: currTaskId, habits: currHabits, dailyMilestones: currMilestones } = currentState.current;
      const totalTodaySecs = currStudySecs + diff;

      // Lucky Milestones
      currMilestones.targets.forEach((target) => {
        if (totalTodaySecs >= target && !currMilestones.reached.includes(target)) {
          const updatedReached = [...currMilestones.reached, target];
          const newMState = { ...currMilestones, reached: updatedReached };
          setDailyMilestones(newMState);
          localStorage.setItem('lucky_milestones', JSON.stringify(newMState));
          setMilestonePopup(target);
        }
      });

      // 🔄 AUTO-SYNC TO DB EVERY 60 SECONDS (Ensures History is always accurate)
      if (diff > 0 && diff % 60 === 0) {
        const activeTask = currTodos.find(t => t.id === currTaskId);
        const sType = activeTask?.studyType || 'self';
        const updatedTodos = currTodos.map(t => t.id === currTaskId ? { ...t, trackedSeconds: (t.trackedSeconds || 0) + diff } : t);
        syncWorkspaceToSupabase(currHabits, updatedTodos, currStudySecs + diff, currSelf + (sType === 'self' ? diff : 0), currClass + (sType === 'class' ? diff : 0));
      }

      // 🛑 2 HOURS AUTO-PAUSE LOGIC
      if (diff >= 7200) {
        clearInterval(timerRef.current);
        const newStudySecs = currStudySecs + diff;
        const activeTask = currTodos.find(t => t.id === currTaskId);
        const sType = activeTask?.studyType || 'self';
        const newSelf = currSelf + (sType === 'self' ? diff : 0);
        const newClass = currClass + (sType === 'class' ? diff : 0);
        const updatedTodos = currTodos.map(t => t.id === currTaskId ? { ...t, trackedSeconds: (t.trackedSeconds || 0) + diff } : t);
        
        setStudySeconds(newStudySecs); setSelfStudySeconds(newSelf); setClassSeconds(newClass); setTodos(updatedTodos); setActiveTaskId(null); setLiveSeconds(0); sessionStartRef.current = null;
        
        localStorage.removeItem('active_task_id'); localStorage.removeItem('active_task_start'); localStorage.removeItem('last_tick'); localStorage.removeItem('active_task_title');
        window.dispatchEvent(new Event('presence_update'));
        
        // Instant DB Clear
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) supabase.from('profiles').update({ active_task: null, task_expires_at: null }).eq('id', session.user.id).then();
        });
        
        syncWorkspaceToSupabase(currHabits, updatedTodos, newStudySecs, newSelf, newClass);
        try { new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg').play(); } catch(e) {}
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("⏳ Focus Limit Reached!", { body: "You've studied for 2 hours straight. Take a break!", icon: "/favicon.ico" });
        } else alert("⏳ Focus limit reached! Take a short break!");
      } else {
        setLiveSeconds(diff);
      }
    }, 1000);
  };

  const syncWorkspaceToSupabase = async (newHabits, newTodos, overrideStudySeconds = null, overrideSelf = null, overrideClass = null) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const payload = {
        user_id: session.user.id, date_str: trueDateStr.current, water: newHabits.water, meal: newHabits.meal, prayer: newHabits.prayer,
        sleep: newHabits.sleepChecked, workout: newHabits.exerciseChecked, tasks_completed: newTodos.filter(t => t.isDone).length, todos: newTodos, 
        study_seconds: overrideStudySeconds !== null ? overrideStudySeconds : studySeconds,
        self_study_seconds: overrideSelf !== null ? overrideSelf : selfStudySeconds, class_seconds: overrideClass !== null ? overrideClass : classSeconds
      };
      await supabase.from('daily_logs').upsert(payload, { onConflict: 'user_id, date_str' });
    } catch (error) {}
  };

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
      } catch (err) {}

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.from('daily_logs').select('*').eq('user_id', session.user.id).eq('date_str', trueDateStr.current).single();

      let finalHabits = { water: 0, meal: 0, prayer: 0, sleepChecked: false, exerciseChecked: false };
      let finalTodos = []; let finalStudySeconds = 0; let finalSelf = 0; let finalClass = 0;

      if (data && !error) {
        finalHabits = { water: data.water || 0, meal: data.meal || 0, prayer: data.prayer || 0, sleepChecked: data.sleep || false, exerciseChecked: data.workout || false };
        if (data.todos) finalTodos = data.todos;
        if (data.study_seconds) finalStudySeconds = parseInt(data.study_seconds, 10);
        if (data.self_study_seconds) finalSelf = parseInt(data.self_study_seconds, 10);
        if (data.class_seconds) finalClass = parseInt(data.class_seconds, 10);
      }

      // 🔄 SMART RECOVERY ENGINE
      const savedTaskId = localStorage.getItem('active_task_id');
      const savedStart = localStorage.getItem('active_task_start');
      const lastTick = localStorage.getItem('last_tick');

      if (savedTaskId && savedStart && lastTick && isMounted) {
        const startStr = new Date(Number(savedStart)).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' });
        const now = Date.now();
        const tickDiff = Math.floor((now - Number(lastTick)) / 1000);

        if (tickDiff <= 5 && startStr === trueDateStr.current) {
           setActiveTaskId(Number(savedTaskId)); sessionStartRef.current = Number(savedStart); startTimerInterval(Number(savedStart));
           const resumedTask = finalTodos.find(t => t.id === Number(savedTaskId));
           if (resumedTask) {
             localStorage.setItem('active_task_title', resumedTask.title);
             window.dispatchEvent(new Event('presence_update'));
             
             // 🚀 Instant DB resume
             const expiresAt = new Date(Date.now() + 7200 * 1000).toISOString();
             supabase.from('profiles').update({ active_task: resumedTask.title, task_expires_at: expiresAt }).eq('id', session.user.id).then();
           }
        } else {
          const sessionSecs = Math.floor((Number(lastTick) - Number(savedStart)) / 1000);
          const validSecs = Math.min(sessionSecs, 7200); 

          if (validSecs > 0) {
            const resumedTask = finalTodos.find(t => t.id === Number(savedTaskId));
            const sType = resumedTask?.studyType || 'self';
            if (startStr === trueDateStr.current) {
              finalStudySeconds += validSecs; if (sType === 'class') finalClass += validSecs; else finalSelf += validSecs;
              finalTodos = finalTodos.map(t => t.id === Number(savedTaskId) ? { ...t, trackedSeconds: (t.trackedSeconds || 0) + validSecs } : t);
              await supabase.from('daily_logs').upsert({
                user_id: session.user.id, date_str: trueDateStr.current, water: finalHabits.water, meal: finalHabits.meal, prayer: finalHabits.prayer,
                sleep: finalHabits.sleepChecked, workout: finalHabits.exerciseChecked, tasks_completed: finalTodos.filter(t => t.isDone).length, todos: finalTodos, 
                study_seconds: finalStudySeconds, self_study_seconds: finalSelf, class_seconds: finalClass
              }, { onConflict: 'user_id, date_str' });
            } else {
              const { data: oldData } = await supabase.from('daily_logs').select('*').eq('user_id', session.user.id).eq('date_str', startStr).single();
              if (oldData) {
                  const oldTodos = (oldData.todos || []).map(t => t.id === Number(savedTaskId) ? { ...t, trackedSeconds: (t.trackedSeconds || 0) + validSecs } : t);
                  const oldStudySecs = parseInt(oldData.study_seconds || 0, 10) + validSecs;
                  const oldSelf = parseInt(oldData.self_study_seconds || 0, 10) + (sType === 'self' ? validSecs : 0);
                  const oldClass = parseInt(oldData.class_seconds || 0, 10) + (sType === 'class' ? validSecs : 0);
                  await supabase.from('daily_logs').upsert({ ...oldData, todos: oldTodos, study_seconds: oldStudySecs, self_study_seconds: oldSelf, class_seconds: oldClass }, { onConflict: 'user_id, date_str' });
              }
            }
          }
          localStorage.removeItem('active_task_id'); localStorage.removeItem('active_task_start'); localStorage.removeItem('last_tick'); localStorage.removeItem('active_task_title');
          window.dispatchEvent(new Event('presence_update'));
          supabase.from('profiles').update({ active_task: null, task_expires_at: null }).eq('id', session.user.id).then();
        }
      }

      setHabits(finalHabits); setTodos(finalTodos); setStudySeconds(finalStudySeconds); setSelfStudySeconds(finalSelf); setClassSeconds(finalClass); setLoadingData(false);
    };

    initializeWorkspace();
    return () => { isMounted = false; clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    const midnightChecker = setInterval(() => {
      const currentBDDate = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' });

      if (currentBDDate !== trueDateStr.current) {
        const { habits: currHabits, todos: currTodos, studySeconds: currStudySecs, selfStudySeconds: currSelf, classSeconds: currClass, activeTaskId: currActiveTask } = currentState.current;
        let oldStudySecs = currStudySecs; let oldSelf = currSelf; let oldClass = currClass; let oldTodos = [...currTodos];

        if (currActiveTask && sessionStartRef.current) {
          const sessionSecs = Math.floor((Date.now() - sessionStartRef.current) / 1000); oldStudySecs += sessionSecs;
          const task = oldTodos.find(t => t.id === currActiveTask); const sType = task?.studyType || 'self';
          if (sType === 'class') oldClass += sessionSecs; else oldSelf += sessionSecs;
          oldTodos = oldTodos.map(t => t.id === currActiveTask ? { ...t, trackedSeconds: (t.trackedSeconds || 0) + sessionSecs } : t);
        }

        const saveOldDayData = async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;
          await supabase.from('daily_logs').upsert({
            user_id: session.user.id, date_str: trueDateStr.current, water: currHabits.water, meal: currHabits.meal, prayer: currHabits.prayer,
            sleep: currHabits.sleepChecked, workout: currHabits.exerciseChecked, tasks_completed: oldTodos.filter(t => t.isDone).length, todos: oldTodos, 
            study_seconds: oldStudySecs, self_study_seconds: oldSelf, class_seconds: oldClass 
          }, { onConflict: 'user_id, date_str' });
        };
        saveOldDayData();

        trueDateStr.current = currentBDDate;
        setHabits({ water: 0, meal: 0, prayer: 0, sleepChecked: false, exerciseChecked: false });
        setTodos(oldTodos.map(t => ({ ...t, trackedSeconds: 0, isDone: false })));
        setStudySeconds(0); setSelfStudySeconds(0); setClassSeconds(0);

        if (currActiveTask) {
          setLiveSeconds(0); const now = Date.now(); sessionStartRef.current = now;
          localStorage.setItem('active_task_start', now); localStorage.setItem('last_tick', now); 
        }
      }
    }, 1000);
    return () => clearInterval(midnightChecker);
  }, []);

  const handlePlay = async (taskId) => {
    if (activeTaskId === taskId) return;
    if (activeTaskId) getSafePauseData(activeTaskId); 

    setActiveTaskId(taskId); setLiveSeconds(0);
    const now = Date.now(); sessionStartRef.current = now;
    
    localStorage.setItem('active_task_id', taskId); localStorage.setItem('active_task_start', now); localStorage.setItem('last_tick', now);

    const task = todos.find(t => t.id === taskId);
    if (task) {
      localStorage.setItem('active_task_title', task.title);
      window.dispatchEvent(new Event('presence_update'));

      // 🚀 INSTANT DB PRESENCE UPDATE (Zero delay)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const expiresAt = new Date(Date.now() + 7200 * 1000).toISOString();
        supabase.from('profiles').update({ active_task: task.title, task_expires_at: expiresAt }).eq('id', session.user.id).then();
      }
    }
    startTimerInterval(now);
  };

  const getSafePauseData = (targetTaskId) => {
    let newStudySecs = studySeconds; let newSelf = selfStudySeconds; let newClass = classSeconds; let updatedTodos = [...todos];

    if (activeTaskId === targetTaskId) {
      clearInterval(timerRef.current);
      const sessionSecs = Math.floor((Date.now() - sessionStartRef.current) / 1000); newStudySecs += sessionSecs;
      
      const task = updatedTodos.find(t => t.id === targetTaskId); const sType = task?.studyType || 'self';
      if (sType === 'class') newClass += sessionSecs; else newSelf += sessionSecs;
      updatedTodos = updatedTodos.map(t => t.id === targetTaskId ? { ...t, trackedSeconds: (t.trackedSeconds || 0) + sessionSecs } : t);
      
      setStudySeconds(newStudySecs); setSelfStudySeconds(newSelf); setClassSeconds(newClass); setActiveTaskId(null); setLiveSeconds(0); sessionStartRef.current = null;

      localStorage.removeItem('active_task_id'); localStorage.removeItem('active_task_start'); localStorage.removeItem('last_tick'); localStorage.removeItem('active_task_title');
      window.dispatchEvent(new Event('presence_update'));

      // 🚀 INSTANT DB CLEAR
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) supabase.from('profiles').update({ active_task: null, task_expires_at: null }).eq('id', session.user.id).then();
      });
    }
    return { newStudySecs, newSelf, newClass, updatedTodos };
  };

  const handlePause = (taskId) => {
    if (activeTaskId !== taskId) return;
    const { newStudySecs, newSelf, newClass, updatedTodos } = getSafePauseData(taskId);
    setTodos(updatedTodos);
    syncWorkspaceToSupabase(habits, updatedTodos, newStudySecs, newSelf, newClass);
  };

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600); const m = Math.floor((totalSeconds % 3600) / 60); const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const updateHabit = (type, value, maxVal) => {
    const validValue = maxVal ? Math.min(Math.max(0, value), maxVal) : Math.max(0, value);
    const newHabits = { ...habits, [type]: validValue }; setHabits(newHabits); syncWorkspaceToSupabase(newHabits, todos);
  };

  const handleAddAcademicTodo = () => {
    if (!selectedSubject || !selectedChapter || selectedActions.length === 0) return;
    const newTask = {
      id: Date.now(), type: 'academic', studyType: newTaskStudyType, subjectKey: selectedSubject, subjectName: initialData.academics[selectedSubject].name,
      chapterIndex: selectedChapter, actions: selectedActions, title: `${initialData.academics[selectedSubject].chapters[selectedChapter]}`, isDone: false, trackedSeconds: 0
    };
    const newTodos = [...todos, newTask]; setTodos(newTodos); syncWorkspaceToSupabase(habits, newTodos);
    setSelectedChapter(''); setSelectedActions(['basic']);
  };

  const handleAddCustomTodo = () => {
    if (customTaskInput.trim() === "") return;
    const newTask = { id: Date.now(), type: 'custom', studyType: newTaskStudyType, title: customTaskInput, actions: ['task'], isDone: false, trackedSeconds: 0 };
    const newTodos = [...todos, newTask]; setTodos(newTodos); syncWorkspaceToSupabase(habits, newTodos); setCustomTaskInput("");
  };

  const handleTodoCheckClick = (todo) => { if (!todo.isDone && todo.type === 'academic') setSyncPopupTask(todo); else processTodoStatus(todo.id, false, !todo.isDone); };

  const processTodoStatus = (id, shouldSyncSyllabus, forceStatus) => {
    const { newStudySecs, newSelf, newClass, updatedTodos } = getSafePauseData(id); 
    const finalTodos = updatedTodos.map(t => {
      if (t.id === id) { if (shouldSyncSyllabus && t.type === 'academic') syncSyllabusFromTodo(t.subjectKey, t.chapterIndex, t.actions); return { ...t, isDone: forceStatus }; } return t;
    });
    setTodos(finalTodos); syncWorkspaceToSupabase(habits, finalTodos, newStudySecs, newSelf, newClass); setSyncPopupTask(null); 
  };

  const deleteTodo = (id) => {
    const { newStudySecs, newSelf, newClass, updatedTodos } = getSafePauseData(id); 
    const finalTodos = updatedTodos.filter(t => t.id !== id); setTodos(finalTodos); syncWorkspaceToSupabase(habits, finalTodos, newStudySecs, newSelf, newClass);
  };

  const toggleActionSelection = (action) => setSelectedActions(prev => prev.includes(action) ? prev.filter(a => a !== action) : [...prev, action]);
  const formatName = (name) => name ? name.charAt(0).toUpperCase() + name.slice(1).toLowerCase() : "Scholar";
  const getAvailableActions = (subjectKey) => {
    if (!subjectKey) return ['basic', 'cq', 'mcq', 'mastered']; const keyLower = subjectKey.toLowerCase();
    if (keyLower.includes('english') || keyLower.includes('ict')) return ['basic', 'mastered'];
    if (keyLower.includes('bangla_2nd') || keyLower.includes('bangla2')) return ['basic', 'mcq', 'mastered'];
    return ['basic', 'cq', 'mcq', 'mastered'];
  };

  const totalExpectedTasks = todos.length; const completedTasks = todos.filter(t => t.isDone).length;
  const progressPercent = totalExpectedTasks === 0 ? 0 : Math.round((completedTasks / totalExpectedTasks) * 100);

  if (loadingData) return <div className="min-h-screen flex justify-center items-center text-[#10a37f] font-bold tracking-widest uppercase text-sm animate-pulse">Syncing Workspace...</div>;

  return (
    <div className="pt-6 pb-24 font-sans text-slate-800 relative">
      
      {/* 🎁 MILESTONE POPUP */}
      {milestonePopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-transparent animate-in fade-in duration-300">
          <div className="bg-[#10a37f]/95 backdrop-blur-3xl rounded-[2rem] p-8 shadow-2xl max-w-sm w-full border border-[#0e8c6d] text-center transform transition-transform text-white">
            <div className="w-16 h-16 mx-auto rounded-full bg-white/20 flex items-center justify-center text-white mb-4 border border-white/30 shadow-inner">
              <Trophy size={32} />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Milestone Unlocked!</h3>
            <p className="text-emerald-50 font-medium mb-6">You've hit a surprise study milestone today! <br/> Great job staying consistent. 🚀</p>
            <button onClick={() => setMilestonePopup(null)} className="w-full py-3 rounded-xl font-bold text-[#10a37f] bg-white shadow-md hover:bg-emerald-50 transition-all">Awesome, let's go!</button>
          </div>
        </div>
      )}

      {/* 🌟 SYLLABUS SYNC POPUP */}
      {syncPopupTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-transparent animate-in fade-in duration-200">
          <div className="bg-sky-50/95 backdrop-blur-3xl rounded-[2rem] p-6 shadow-2xl max-w-sm w-full border border-sky-200">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center text-sky-500 shadow-sm border border-white"><BookOpen size={24} /></div>
              <div><h3 className="text-xl font-bold text-slate-800 leading-tight">Update Syllabus Progress?</h3><p className="text-xs font-medium text-slate-600 mt-0.5">You finished this task!</p></div>
            </div>
            <div className="bg-white/70 p-4 rounded-2xl mb-6 border border-white/60 shadow-sm">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{syncPopupTask.subjectName}</p>
              <p className="text-[15px] font-semibold text-slate-800 leading-snug">{syncPopupTask.title}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {syncPopupTask.actions.map(act => <span key={act} className="text-[10px] font-bold bg-[#10a37f]/10 text-[#10a37f] border border-[#10a37f]/20 px-2 py-0.5 rounded-md uppercase tracking-wide">{act}</span>)}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => processTodoStatus(syncPopupTask.id, false, true)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-slate-600 bg-white/90 border border-white hover:bg-white transition-all shadow-sm">No, just here</button>
              <button onClick={() => processTodoStatus(syncPopupTask.id, true, true)} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-[#10a37f] hover:bg-[#0e8c6d] border border-[#10a37f] transition-all shadow-sm">Yes, update it</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 px-3">
        <div className="text-center mb-6 sm:mb-8"><h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Your Study Workspace</h1><p className="text-slate-500 font-normal mt-2">Plan your study tasks, focus deeply, and track your daily health habits.</p></div>

        {/* 🔴 LIVE STUDY ROOM */}
        <div className="bg-sky-50/40 backdrop-blur-2xl border border-sky-100/60 shadow-sm rounded-3xl p-5 sm:p-6 transition-all duration-300">
          <h2 className="text-xl font-medium text-slate-800 flex items-center justify-between mb-4 border-b border-sky-100/50 pb-4">
            <div className="flex items-center gap-2"><Users size={20} className="text-sky-500" /> Live Study Room</div>
            <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 shadow-sm">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{onlineUsers.length} Active</span>
            </div>
          </h2>
          <div className="w-full transition-all duration-300">
            {onlineUsers.length === 0 ? (
              <div className="text-center py-6 text-slate-400 bg-white/40 rounded-2xl border border-dashed border-sky-200"><p className="text-sm font-medium">It's quiet here right now...</p><p className="text-xs mt-1">Start a task to join the live room and inspire others!</p></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {onlineUsers.map((user, idx) => (
                  <div key={idx} className="bg-white border border-sky-50 p-3 rounded-2xl shadow-sm flex items-start gap-3 hover:border-[#10a37f]/30 transition-all group">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#10a37f] to-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-inner flex-shrink-0 group-hover:scale-110 transition-transform">{user.username?.charAt(0).toUpperCase()}</div>
                    <div className="flex-1 min-w-0"><p className="text-[13px] font-semibold text-slate-800 truncate">{formatName(user.username)}</p><p className="text-[11px] font-medium text-[#10a37f] truncate mt-0.5 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#10a37f] animate-pulse"></span> {user.task}</p></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 📊 PROGRESS BAR */}
        <div className="bg-sky-50/40 backdrop-blur-2xl border border-sky-100/60 shadow-sm rounded-3xl p-5 sm:p-6 transition-all duration-300">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="w-full md:w-1/2">
              <div className="flex justify-between items-end mb-2"><span className="text-sm font-medium text-slate-600">Daily Task Progress</span><span className="text-lg font-semibold text-[#10a37f]">{progressPercent}%</span></div>
              <div className="h-2 w-full bg-sky-100 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-[#10a37f] transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }} /></div>
              <div className="flex justify-between items-center mt-3 border-t border-sky-100/60 pt-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><BookOpen size={12} className="text-[#10a37f]"/> Self Study: {formatTime(selfStudySeconds)}</span>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><GraduationCap size={12} className="text-indigo-500"/> Class: {formatTime(classSeconds)}</span>
              </div>
            </div>
            {activeTaskId && (
              <div className="flex items-center gap-3 bg-[#10a37f]/10 border border-[#10a37f]/20 px-4 py-2 rounded-xl shadow-sm">
                <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10a37f] opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-[#10a37f]"></span></span>
                <span className="text-xs font-medium text-[#10a37f] tracking-wide">You are live</span>
              </div>
            )}
          </div>
        </div>

        {/* 🎯 MISSIONS */}
        <div className="bg-sky-50/40 backdrop-blur-2xl border border-sky-100/60 shadow-sm rounded-3xl p-5 sm:p-6 transition-all duration-300">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-sky-100/50 pb-4">
            <h2 className="text-xl font-medium text-slate-800 flex items-center gap-2"><Activity size={20} className="text-slate-400" /> Your Tasks for Today</h2>
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-sky-100">
              <button onClick={() => setTaskMode('academic')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${taskMode === 'academic' ? 'bg-[#10a37f] text-white' : 'text-slate-500 hover:text-slate-700'}`}>From Syllabus</button>
              <button onClick={() => setTaskMode('custom')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${taskMode === 'custom' ? 'bg-[#10a37f] text-white' : 'text-slate-500 hover:text-slate-700'}`}>Custom Task</button>
            </div>
          </div>
          <div className="bg-white/60 border border-sky-50 rounded-2xl p-4 shadow-sm mb-6">
            <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-sky-50/50">
              <span className="w-full text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Study Mode</span>
              <button onClick={() => setNewTaskStudyType('self')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-semibold border transition-all ${newTaskStudyType === 'self' ? 'bg-[#10a37f]/10 text-[#10a37f] border-[#10a37f]/30 shadow-sm' : 'bg-white text-slate-500 border-sky-100 hover:bg-slate-50'}`}><BookOpen size={14} /> Self Study</button>
              <button onClick={() => setNewTaskStudyType('class')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-semibold border transition-all ${newTaskStudyType === 'class' ? 'bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm' : 'bg-white text-slate-500 border-sky-100 hover:bg-slate-50'}`}><GraduationCap size={14} />Online Class</button>
            </div>
            {taskMode === 'academic' ? (
              <div className="space-y-3">
                <div className="flex bg-slate-100/80 p-1 rounded-xl shadow-inner border border-slate-200/50 w-full sm:w-fit">
                  <button onClick={() => setActiveGroup('science')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${activeGroup === 'science' ? 'bg-white shadow-sm text-[#10a37f]' : 'text-slate-500 hover:text-slate-700'}`}><GraduationCap size={14} /> Science</button>
                  <button onClick={() => setActiveGroup('arts')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${activeGroup === 'arts' ? 'bg-white shadow-sm text-sky-500' : 'text-slate-500 hover:text-slate-700'}`}><Palette size={14} /> Arts</button>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select className="flex-1 bg-white border border-sky-100 rounded-xl px-3 py-2.5 text-sm font-normal text-slate-700 focus:outline-none focus:border-[#10a37f] transition-all" value={selectedSubject} onChange={(e) => { setSelectedSubject(e.target.value); setSelectedChapter(''); setSelectedActions(['basic']); }}>
                    <option value="">Choose a subject...</option>{filteredSubjects.map(([key, subject]) => <option key={key} value={key}>{subject.name}</option>)}
                  </select>
                  <select className="flex-1 bg-white border border-sky-100 rounded-xl px-3 py-2.5 text-sm font-normal text-slate-700 focus:outline-none focus:border-[#10a37f] disabled:opacity-50 transition-all" value={selectedChapter} onChange={(e) => setSelectedChapter(e.target.value)} disabled={!selectedSubject}>
                    <option value="">Choose a chapter...</option>{selectedSubject && initialData.academics[selectedSubject].chapters.map((chapter, index) => <option key={index} value={index}>{chapter}</option>)}
                  </select>
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2 border-t border-sky-50">
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">{getAvailableActions(selectedSubject).map(action => (<button key={action} onClick={() => toggleActionSelection(action)} className={`px-3 py-1.5 text-xs font-medium uppercase tracking-wide rounded-lg transition-all shadow-sm ${selectedActions.includes(action) ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-700'}`}>{action}</button>))}</div>
                  <button onClick={handleAddAcademicTodo} className="w-full sm:w-auto bg-[#10a37f] text-white px-5 py-2 rounded-xl hover:bg-[#0e8c6d] transition-all shadow-sm font-medium flex items-center justify-center gap-1.5 text-sm"><Plus size={16} /> Add to Plan</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <input type="text" value={customTaskInput} onChange={(e) => setCustomTaskInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTodo()} placeholder="Type a personal task..." className="flex-1 bg-white border border-sky-100 rounded-xl px-4 py-2.5 text-sm font-normal text-slate-700 focus:outline-none focus:border-[#10a37f] transition-all" />
                <button onClick={handleAddCustomTodo} className="w-full sm:w-auto bg-[#10a37f] text-white px-5 py-2.5 rounded-xl font-medium hover:bg-[#0e8c6d] transition-all shadow-sm flex items-center justify-center gap-1.5 text-sm"><Plus size={16} /> Add to Plan</button>
              </div>
            )}
          </div>
          <div className="space-y-3">
            {todos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 bg-white/40 rounded-2xl border border-dashed border-sky-200 text-slate-400"><Activity size={24} className="mb-2 opacity-50" /><p className="text-sm font-normal">Your list is empty. Add a topic or custom task to start focusing.</p></div>
            ) : (
              todos.map(todo => {
                const isRunning = activeTaskId === todo.id;
                const displayTime = (todo.trackedSeconds || 0) + (isRunning ? liveSeconds : 0);
                const sType = todo.studyType || 'self';
                return (
                  <div key={todo.id} className={`bg-white border rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all duration-300 ${todo.isDone ? 'border-transparent bg-slate-50/50 opacity-70' : isRunning ? 'border-[#10a37f]/40 shadow-sm' : 'border-sky-50 hover:shadow-sm hover:border-sky-100'}`}>
                    <div className="flex items-start md:items-center gap-3 flex-1 w-full">
                      <button onClick={() => handleTodoCheckClick(todo)} className={`mt-0.5 md:mt-0 w-5 h-5 flex-shrink-0 rounded-md border flex items-center justify-center transition-all duration-300 ${todo.isDone ? 'bg-green-500 border-green-500 text-white' : 'bg-transparent border-slate-300 hover:border-[#10a37f]'}`}>{todo.isDone && <Check size={12} strokeWidth={3} />}</button>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          {sType === 'class' ? (<span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded flex items-center gap-1 uppercase tracking-wide"><GraduationCap size={10}/> Class</span>) : (<span className="text-[9px] font-bold text-[#10a37f] bg-[#10a37f]/10 border border-[#10a37f]/20 px-1.5 py-0.5 rounded flex items-center gap-1 uppercase tracking-wide"><BookOpen size={10}/> Self</span>)}
                          {todo.type === 'academic' && (<><span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{todo.subjectName}</span>{todo.actions.map(act => (<span key={act} className="text-[10px] font-medium text-slate-500 border border-slate-200 px-2 py-0.5 rounded-md uppercase tracking-wide">{act}</span>))}</>)}
                        </div>
                        <span className={`text-sm font-normal transition-all ${todo.isDone ? 'line-through text-slate-400' : isRunning ? 'text-[#10a37f] font-medium' : 'text-slate-700'}`}>{todo.title}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end w-full md:w-auto mt-2 md:mt-0 pl-8 md:pl-0 gap-3">
                      <div className={`font-mono text-sm tracking-tight tabular-nums font-medium px-2.5 py-1 rounded-lg border ${isRunning ? 'text-[#10a37f] bg-[#10a37f]/10 border-[#10a37f]/20' : 'text-slate-500 bg-slate-50 border-slate-100'}`}>{formatTime(displayTime)}</div>
                      <div className="flex items-center gap-1.5">
                        {!todo.isDone && (isRunning ? (<button onClick={() => handlePause(todo.id)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-all border border-rose-100"><Pause size={16} className="fill-current" /></button>) : (<button onClick={() => handlePlay(todo.id)} className="p-1.5 bg-sky-50 text-sky-600 rounded-lg hover:bg-sky-100 transition-all border border-sky-100"><Play size={16} className="fill-current ml-0.5" /></button>))}
                        <button onClick={() => deleteTodo(todo.id)} className={`p-1.5 rounded-lg transition-all ${todo.isDone ? 'text-slate-300 hover:text-red-500 hover:bg-red-50' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 💪 4. PHYSICAL CORE */}
        <div className="bg-sky-50/40 backdrop-blur-2xl border border-sky-100/60 shadow-sm rounded-3xl p-5 sm:p-6 transition-all duration-300">
          <h2 className="text-xl font-medium text-slate-800 flex items-center gap-2 mb-6 border-b border-sky-100/50 pb-4"><Activity size={20} className="text-slate-400" /> Daily Health & Habits</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-sky-50 rounded-2xl p-4 shadow-sm hover:border-sky-100 transition-all"><div className="flex justify-between items-center mb-3"><div className="flex items-center gap-2"><Droplets size={16} className="text-sky-500" /><span className="text-sm font-medium text-slate-700">Drink Water</span></div><span className="text-xs font-medium text-slate-400">{habits.water}/12</span></div><div className="flex flex-wrap gap-1.5 justify-between">{Array.from({ length: 12 }).map((_, i) => { const isFilled = i < habits.water; return (<button key={i} disabled={isFilled} onClick={() => updateHabit('water', habits.water + 1, 12)} className={`w-6 h-6 rounded-full flex items-center justify-center transition-all border ${isFilled ? 'bg-[#10a37f] border-[#10a37f] text-white' : 'bg-slate-50 border-slate-200 hover:border-[#10a37f] cursor-pointer'}`}>{isFilled && <Check size={12} strokeWidth={3} />}</button>) })}</div></div>
            <div className="bg-white border border-sky-50 rounded-2xl p-4 shadow-sm hover:border-sky-100 transition-all"><div className="flex justify-between items-center mb-3"><div className="flex items-center gap-2"><Utensils size={16} className="text-orange-500" /><span className="text-sm font-medium text-slate-700">Have Meals</span></div><span className="text-xs font-medium text-slate-400">{habits.meal}/4</span></div><div className="flex gap-2">{Array.from({ length: 4 }).map((_, i) => { const isFilled = i < habits.meal; return (<button key={i} disabled={isFilled} onClick={() => updateHabit('meal', habits.meal + 1, 4)} className={`flex-1 h-8 rounded-lg flex items-center justify-center transition-all border ${isFilled ? 'bg-[#10a37f] border-[#10a37f] text-white' : 'bg-slate-50 border-slate-200 hover:border-[#10a37f] cursor-pointer'}`}>{isFilled && <Check size={14} strokeWidth={3} />}</button>) })}</div></div>
            <div className="bg-white border border-sky-50 rounded-2xl p-4 shadow-sm hover:border-sky-100 transition-all"><div className="flex justify-between items-center mb-3"><div className="flex items-center gap-2"><BookOpen size={16} className="text-indigo-500" /><span className="text-sm font-medium text-slate-700">Prayers / Meditation</span></div><span className="text-xs font-medium text-slate-400">{habits.prayer}/5</span></div><div className="flex gap-2 justify-between">{Array.from({ length: 5 }).map((_, i) => { const isFilled = i < habits.prayer; return (<button key={i} disabled={isFilled} onClick={() => updateHabit('prayer', habits.prayer + 1, 5)} className={`flex-1 h-8 rounded-lg flex items-center justify-center transition-all border ${isFilled ? 'bg-[#10a37f] border-[#10a37f] text-white' : 'bg-slate-50 border-slate-200 hover:border-[#10a37f] cursor-pointer'}`}>{isFilled && <Check size={14} strokeWidth={3} />}</button>) })}</div></div>
            <div className="bg-white border border-sky-50 rounded-2xl p-4 shadow-sm hover:border-sky-100 transition-all flex flex-col justify-center gap-4"><button disabled={habits.sleepChecked} onClick={() => updateHabit('sleepChecked', true)} className="flex justify-between items-center cursor-pointer group text-left w-full disabled:cursor-default"><div className="flex items-center gap-2.5"><Moon size={16} className="text-violet-500" /><span className={`text-sm font-normal transition-colors ${habits.sleepChecked ? 'text-slate-400' : 'text-slate-700 group-hover:text-violet-600'}`}>Get 7+ Hours of Sleep</span></div><div className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center ${habits.sleepChecked ? 'bg-green-500 border-green-500 text-white' : 'bg-slate-50 border-slate-300 group-hover:border-[#10a37f]'}`}>{habits.sleepChecked && <Check size={12} strokeWidth={3} />}</div></button><div className="h-px w-full bg-slate-100"></div><button disabled={habits.exerciseChecked} onClick={() => updateHabit('exerciseChecked', true)} className="flex justify-between items-center cursor-pointer group text-left w-full disabled:cursor-default"><div className="flex items-center gap-2.5"><Activity size={16} className="text-rose-500" /><span className={`text-sm font-normal transition-colors ${habits.exerciseChecked ? 'text-slate-400' : 'text-slate-700 group-hover:text-rose-600'}`}>Exercise (30 Mins)</span></div><div className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center ${habits.exerciseChecked ? 'bg-green-500 border-green-500 text-white' : 'bg-slate-50 border-slate-300 group-hover:border-[#10a37f]'}`}>{habits.exerciseChecked && <Check size={12} strokeWidth={3} />}</div></button></div>
          </div>
        </div>
      </div>
    </div>
  );
}