import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { CheckCircle, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [loading, setLoading] = useState(true);
  
  // 🧠 SMART LOGIN/SIGNUP DETECTOR
  const [isLogin, setIsLogin] = useState(() => {
    const hasVisited = localStorage.getItem('has_visited_taskflow');
    if (!hasVisited) {
      // প্রথমবার আসলে সাইন-আপ দেখাবে এবং মেমোরিতে সেভ করে রাখবে যে সে ভিজিট করেছে
      localStorage.setItem('has_visited_taskflow', 'true');
      return false; 
    }
    // পরের বার থেকে ডিফল্ট লগইন দেখাবে
    return true; 
  });

  const [showPassword, setShowPassword] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  
  const [session, setSession] = useState(null);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [authMsg, setAuthMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleAuthTransition(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleAuthTransition(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuthTransition = async (currentSession) => {
    setSession(currentSession);
    if (currentSession) {
      await checkProfileStatus(currentSession.user.id);
    } else {
      setLoading(false);
    }
  };

  const checkProfileStatus = async (userId) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .maybeSingle();
      
    if (error || !data || !data.username) {
      setNeedsUsername(true);
    } else {
      window.location.href = "/"; 
    }
    setLoading(false);
  };

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthMsg({ type: '', text: '' });

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthMsg({ type: 'error', text: error.message });
        setLoading(false);
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setAuthMsg({ type: 'error', text: error.message });
        setLoading(false);
      } else if (data.user && !data.session) {
        setAuthMsg({ type: 'success', text: 'Verification link sent! Please check your email inbox.' });
        setLoading(false);
      }
    }
  };

  // 🛡️ Error reporting fixed here as well
  const saveUsernameAndStart = async () => {
    const cleanUsername = usernameInput.trim();
    if (!cleanUsername || cleanUsername.length < 3) {
      return alert("Username must be at least 3 characters.");
    }
    setLoading(true);
    
    const { error } = await supabase.from('profiles').upsert([
      { id: session.user.id, username: cleanUsername }
    ], { onConflict: 'id' });

    if (error) {
      console.error("DB Error:", error);
      alert(`Database Error: ${error.message}`);
      setLoading(false);
    } else {
      window.location.href = "/";
    }
  };

  if (loading && !needsUsername && !authMsg.text) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <Loader2 className="animate-spin text-[#10a37f] mb-2" size={32} strokeWidth={2.5} />
        <p className="text-slate-400 font-medium text-xs tracking-widest uppercase">TaskFlow. Syncing</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] flex flex-col items-center justify-center p-4 font-sans text-[#2d333a]">
      
      {/* 💎 OPENAI STYLE PREMIUM CARD */}
      <div className="bg-white border border-slate-200 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)] rounded-2xl p-8 md:p-12 max-w-sm w-full text-center transition-all">
        
        {/* 🚀 BRANDING */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2">
             <CheckCircle size={28} strokeWidth={2.5} className="text-[#10a37f]" />
             <span className="text-2xl font-bold text-slate-900 tracking-tight">TaskFlow.</span>
          </div>
        </div>
        
        <h2 className="text-2xl font-semibold text-slate-800 mb-2 tracking-tight">
          {needsUsername ? "Set your username" : (isLogin ? "Welcome back" : "Create your account")}
        </h2>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
          {needsUsername ? "Choose how you'll appear on the leaderboard." : (isLogin ? "Continue your journey to elite focus." : "Start your journey to elite focus.")}
        </p>

        {!session || (session && !session.user.email_confirmed_at) ? (
          /* 🔐 LOGIN / SIGNUP */
          <form onSubmit={handleAuthAction} className="space-y-4 animate-in fade-in duration-300">
            {authMsg.text && (
              <div className={`text-xs font-medium p-3 rounded-lg border ${authMsg.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                {authMsg.text}
              </div>
            )}
            
            <div className="text-left space-y-1.5">
              <label className="text-[13px] font-semibold text-slate-700 ml-0.5">Email address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3.5 text-slate-900 focus:outline-none focus:border-[#10a37f] focus:ring-1 focus:ring-[#10a37f] transition-all text-base placeholder:text-slate-400"
              />
            </div>

            <div className="text-left space-y-1.5 relative">
              <label className="text-[13px] font-semibold text-slate-700 ml-0.5">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg pl-4 pr-10 py-3.5 text-slate-900 focus:outline-none focus:border-[#10a37f] focus:ring-1 focus:ring-[#10a37f] transition-all text-base placeholder:text-slate-400"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#10a37f] text-white hover:bg-[#0e8c6d] transition-all duration-200 py-3.5 px-6 rounded-lg text-base font-medium shadow-sm active:scale-[0.99] disabled:opacity-70 mt-6"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Continue"}
            </button>

            <p className="text-sm font-normal text-slate-600 mt-6">
              {isLogin ? "Don't have an account?" : "Already have an account?"} 
              <button 
                type="button"
                onClick={() => {setIsLogin(!isLogin); setAuthMsg({type:'', text:''});}}
                className="text-[#10a37f] hover:underline font-medium ml-1"
              >
                {isLogin ? "Sign up" : "Log in"}
              </button>
            </p>
          </form>

        ) : needsUsername ? (
          /* ✍️ USERNAME SELECTION (Upgraded to Ultra-Classy OpenAI Style) */
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-left space-y-2">
              <label className="text-[13px] font-semibold text-slate-700 ml-0.5">Display Name</label>
              <input 
                type="text" 
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="e.g. Scholar24"
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3.5 text-slate-900 focus:outline-none focus:border-[#10a37f] focus:ring-1 focus:ring-[#10a37f] transition-all text-base font-medium placeholder:text-slate-400 placeholder:font-normal"
              />
              <p className="text-[11.5px] font-medium text-slate-500 ml-0.5 pt-1 leading-relaxed">
                This is how you will appear to others on the leaderboard.
              </p>
            </div>
            
            <button 
              onClick={saveUsernameAndStart}
              disabled={loading}
              className="w-full flex items-center justify-center bg-[#10a37f] text-white hover:bg-[#0e8c6d] transition-colors duration-200 py-3.5 px-6 rounded-lg text-base font-medium shadow-sm active:scale-[0.99] disabled:opacity-70 mt-4"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Continue"}
            </button>
          </div>
        ) : (
          <div className="py-8 flex flex-col items-center animate-in fade-in">
             <Loader2 className="animate-spin text-[#10a37f]" size={28} />
             <p className="text-slate-600 text-sm font-medium mt-4">Connecting to Workspace...</p>
          </div>
        )}

      </div>
      
      {/* ✒️ Subtle Copyright */}
      <div className="mt-8 flex items-center gap-4 text-[11px] font-medium text-slate-400">
        <span className="hover:text-slate-600 cursor-pointer transition-colors uppercase tracking-widest">Privacy Policy</span>
        <span className="text-slate-300">|</span>
        <span className="hover:text-slate-600 cursor-pointer transition-colors uppercase tracking-widest">Terms of Service</span>
      </div>
    </div>
  );
}