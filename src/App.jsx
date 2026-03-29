import React, { useState, useEffect, createContext, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Home, BookOpen, Clock, Activity, User, Code, CheckCircle, RotateCcw } from 'lucide-react'; 
import { supabase } from './services/supabase'; 

import Dashboard from './components/dashboard';
import Syllabus from './components/syllabus';
import TimerScreen from './components/timerscreen';
import History from './components/History';
import Leaderboard from './components/leaderboard';
import Account from './components/Account';
import LoginPage from './components/loginpage';
import IOIPrep from './components/ioiprep';

export const ProgressContext = createContext();

// 💎 COMPACT TOP NAVIGATION
const TopNav = ({ isIoiEnabled }) => {
  const location = useLocation();
  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/syllabus', label: 'Syllabus' },
    ...(isIoiEnabled ? [{ path: '/ioi', label: 'IOI Prep' }] : []),
    { path: '/timer', label: 'Workspace' },
    { path: '/history', label: 'History' },
    { path: '/leaderboard', label: 'Rank' },
  ];

  return (
    <nav className="sticky top-0 z-50 px-4 py-2.5 flex justify-between items-center bg-white/80 backdrop-blur-2xl border-b border-sky-100 shadow-sm transition-all">
      <div onClick={() => window.location.href = "/"} className="flex items-center gap-1.5 cursor-pointer group">
        <CheckCircle size={24} strokeWidth={3} className="text-[#10a37f] transition-transform duration-300 group-hover:scale-110" />
        <div className="text-xl font-extrabold text-slate-800 tracking-tight">TaskFlow.</div>
      </div>
      
      <div className="hidden md:flex items-center gap-6">
        {navItems.map((item) => (
          <Link key={item.path} to={item.path} className={`text-[13px] font-bold tracking-wide transition-all ${location.pathname === item.path ? 'text-[#10a37f]' : 'text-slate-500 hover:text-slate-800'}`}>
            {item.label}
          </Link>
        ))}
      </div>
      
      <div className="flex items-center gap-2">
        {isIoiEnabled && (
          <Link to={location.pathname === '/ioi' ? '/' : '/ioi'} className={`md:hidden p-1.5 rounded-full transition-colors ${location.pathname === '/ioi' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-500'}`}>
            <Code size={18} />
          </Link>
        )}
        <Link to="/account" className={`p-1.5 rounded-full transition-all ${location.pathname === '/account' ? 'bg-[#10a37f]/10 text-[#10a37f]' : 'text-slate-500 bg-slate-50 border border-slate-100 hover:bg-slate-100'}`}>
          <User size={18} />
        </Link>
      </div>
    </nav>
  );
};

// 📱 COMPACT MOBILE FOOTER
const MobileFooter = ({ isIoiEnabled }) => {
  const location = useLocation();
  const navItems = [
    { path: '/', icon: <Home size={20} />, label: 'Home' },
    { path: '/syllabus', icon: <BookOpen size={20} />, label: 'Syllabus' },
    { path: '/timer', icon: <Clock size={20} />, label: 'Workspace' },
    { path: '/history', icon: <RotateCcw size={20} />, label: 'History' }, 
    { path: '/leaderboard', icon: <Activity size={20} />, label: 'Rank' },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-2xl border-t border-sky-100 z-50 pb-3 pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
      <div className="flex justify-evenly items-center px-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className={`flex flex-col items-center gap-1 p-1.5 rounded-2xl transition-all ${isActive ? 'text-[#10a37f]' : 'text-slate-400'}`}>
              {item.icon}
              <span className={`text-[9px] font-bold tracking-tight ${isActive ? 'block' : 'hidden'}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasUsername, setHasUsername] = useState(false);
  const [userProfile, setUserProfile] = useState({ username: '', email: '' });
  const [isIoiEnabled, setIsIoiEnabled] = useState(false);
  const [syllabusProgress, setSyllabusProgress] = useState({});

  const fetchSessionAndProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      const { data, error } = await supabase.from('profiles').select('username, syllabus_progress').eq('id', session.user.id).single();
      if (error && (error.message?.includes('JWT') || error.message?.includes('expired'))) {
        await supabase.auth.signOut();
        setSession(null); setHasUsername(false); setLoading(false); return; 
      }
      setSession(session); 
      if (data && data.username) {
        setHasUsername(true);
        setUserProfile({ username: data.username, email: session.user.email });
        if (data.syllabus_progress) setSyllabusProgress(data.syllabus_progress);
      } else setHasUsername(false);
    } else {
      setSession(null); setHasUsername(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSessionAndProfile();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setSession(null); setHasUsername(false); } 
      else fetchSessionAndProfile();
    });
    return () => subscription.unsubscribe();
  }, [fetchSessionAndProfile]);

  useEffect(() => {
    setIsIoiEnabled(localStorage.getItem('ioi_enabled') === 'true');
    const handleIoiChange = () => setIsIoiEnabled(localStorage.getItem('ioi_enabled') === 'true');
    window.addEventListener('ioiStateChanged', handleIoiChange);
    return () => window.removeEventListener('ioiStateChanged', handleIoiChange);
  }, []);

  const updateSyllabusData = async (subjectKey, chapterIndex, actionsArray) => {
    setSyllabusProgress(prev => {
      const currentProgress = prev[subjectKey]?.[chapterIndex] || { basic: false, cq: false, mcq: false, mastered: false, isDone: false };
      if (currentProgress.isDone) return prev;
      const updatedProgress = { ...currentProgress };
      actionsArray.forEach(action => { updatedProgress[action] = true; });
      if (updatedProgress.basic && updatedProgress.cq && updatedProgress.mcq && updatedProgress.mastered) updatedProgress.isDone = true;
      const newGlobalProgress = { ...prev, [subjectKey]: { ...prev[subjectKey], [chapterIndex]: updatedProgress } };
      
      if (session) {
        supabase.from('profiles').update({ syllabus_progress: newGlobalProgress }).eq('id', session.user.id).then(({ error }) => {
           if (error && (error.message?.includes('JWT') || error.message?.includes('expired'))) {
             supabase.auth.signOut(); window.location.reload();
           }
        });
      }
      return newGlobalProgress;
    });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><CheckCircle size={32} className="text-[#10a37f] animate-pulse" /></div>;
  if (!session || !hasUsername) return <LoginPage />;

  return (
    <ProgressContext.Provider value={{ userProfile, syllabusProgress, syncSyllabusFromTodo: updateSyllabusData, manuallyUpdateSyllabus: (s, c, a) => updateSyllabusData(s, c, [a]) }}>
      <Router>
        <div className="min-h-screen flex flex-col bg-[#f8fafc] font-sans antialiased text-slate-800">
          <TopNav isIoiEnabled={isIoiEnabled} />
          <main className="flex-grow pb-20 md:pb-8 px-3">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/syllabus" element={<Syllabus />} />
              <Route path="/ioi" element={<IOIPrep />} />
              <Route path="/timer" element={<TimerScreen />} />
              <Route path="/history" element={<History />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/account" element={<Account />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
          <MobileFooter isIoiEnabled={isIoiEnabled} />
        </div>
      </Router>
    </ProgressContext.Provider>
  );
}