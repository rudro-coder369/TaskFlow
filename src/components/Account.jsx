import React, { useState, useEffect, useRef, useContext } from 'react';
import { ProgressContext } from '../App';
import { supabase } from '../services/supabase';
import { Mail, LogOut, RefreshCw, Code, Settings, Edit2, Check, Camera, Lock, User } from 'lucide-react';

export default function Account() {
  const { userProfile } = useContext(ProgressContext);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isIoiEnabled, setIsIoiEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editUsernameInput, setEditUsernameInput] = useState("");
  const [userId, setUserId] = useState(null);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (userProfile && userProfile.username) {
      setUserName(userProfile.username);
      setEditUsernameInput(userProfile.username);
      setUserEmail(userProfile.email);
    }
    fetchUserData();
    const ioiStatus = localStorage.getItem('ioi_enabled') === 'true';
    setIsIoiEnabled(ioiStatus);
  }, [userProfile]);

  const fetchUserData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUserEmail(session.user.email);
      setUserId(session.user.id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', session.user.id)
        .single();
        
      if (data && !error) {
        setUserName(data.username);
        setEditUsernameInput(data.username);
        if (data.avatar_url) setAvatarUrl(data.avatar_url);
      }
    }
    setLoading(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setAvatarUrl(compressedBase64);
        saveAvatarToDB(compressedBase64);
      };
    };
  };

  const saveAvatarToDB = async (base64Image) => {
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: base64Image })
      .eq('id', userId);
      
    if (error) alert("Failed to save profile picture.");
  };

  const handleSaveUsername = async () => {
    if (!editUsernameInput.trim() || editUsernameInput === userName) {
      setIsEditing(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .upsert([{ id: userId, username: editUsernameInput.trim() }], { onConflict: 'id' });

    if (error) {
      alert("Error updating username. It might be taken!");
    } else {
      setUserName(editUsernameInput.trim());
      setIsEditing(false);
      window.location.reload();
    }
  };

  const toggleIoiPrep = () => {
    if (!isIoiEnabled) {
      const code = window.prompt("Enter secret VIP code to unlock IOI Preparation:");
      if (code !== "369369") {
        alert("❌ Incorrect code. Access Denied.");
        return; 
      }
    }

    const newStatus = !isIoiEnabled;
    setIsIoiEnabled(newStatus);
    localStorage.setItem('ioi_enabled', newStatus);
    window.dispatchEvent(new Event('ioiStateChanged')); 
  };

  const handleHardReset = async () => {
    const confirmReset = window.confirm("⚠️ WARNING: This will PERMANENTLY wipe your entire History, Leaderboard ranks, and Syllabus progress from the Database!");
    if (!confirmReset) return;

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.from('daily_logs').delete().eq('user_id', session.user.id);
      await supabase.from('profiles').update({ syllabus_progress: {} }).eq('id', session.user.id);

      localStorage.removeItem('timer_start_timestamp');
      localStorage.removeItem('timer_accumulated_time');

      alert("Hard Reset Complete! 🚀");
      window.location.reload(); 
    } catch (error) {
      console.error("Hard Reset Error:", error);
      alert("Could not complete Hard Reset. Check console.");
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/"; 
  };

  const defaultAvatar = `https://ui-avatars.com/api/?name=${userName || 'S'}&background=e2e8f0&color=1e293b&font-size=0.4&bold=true`;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 font-medium">Loading Workspace...</div>;
  }

  return (
    <div className="pt-6 font-sans text-[#2d333a] pb-10 flex flex-col min-h-full">
      <div className="max-w-2xl mx-auto space-y-6 px-2 w-full flex-grow">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center justify-center gap-2">
            <Settings size={24} className="text-slate-400" /> Settings
          </h1>
        </div>
        
        <div className="bg-white border border-slate-200 shadow-sm rounded-[1.5rem] flex flex-col items-center text-center p-8 relative transition-all">
          
          <div className="relative mb-6 group cursor-pointer" onClick={() => fileInputRef.current.click()}>
            <div className="h-24 w-24 bg-slate-50 border border-slate-200 rounded-full overflow-hidden flex items-center justify-center transition-all duration-300 group-hover:shadow-md">
              <img 
                src={avatarUrl || defaultAvatar} 
                alt="Profile" 
                className="w-full h-full object-cover" 
              />
            </div>
            
            <div className="absolute inset-0 bg-slate-900/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
              <Camera size={20} className="text-white drop-shadow-md" />
            </div>
            
            <input 
              type="file" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImageUpload}
              accept="image/*"
            />
          </div>
          
          <div className="flex items-center justify-center min-h-[44px] mb-1">
            {isEditing ? (
              <div className="flex items-center border-b-[1.5px] border-slate-300 focus-within:border-[#10a37f] transition-all pb-1 animate-in fade-in duration-200">
                <input 
                  type="text" 
                  value={editUsernameInput}
                  onChange={(e) => setEditUsernameInput(e.target.value)}
                  className="bg-transparent font-semibold text-slate-800 p-1 w-32 sm:w-40 focus:outline-none text-center"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveUsername()}
                />
                <button 
                  onClick={handleSaveUsername} 
                  className="text-slate-400 hover:text-[#10a37f] p-1 ml-2 transition-colors flex items-center gap-1 text-sm font-medium"
                >
                  <Check size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 group cursor-pointer" onClick={() => setIsEditing(true)}>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{userName || "User"}</h2>
                <Edit2 size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="text-[13px] font-medium text-slate-500">{userEmail}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm rounded-[1.5rem] p-3 space-y-1 transition-all">
          <div className="flex justify-between items-center hover:bg-slate-50 p-4 rounded-[1rem] transition-all cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="text-slate-400">
                {isIoiEnabled ? <Code size={20} className="text-[#10a37f]" /> : <Lock size={20} />}
              </div>
              <div className="flex flex-col">
                <span className="text-slate-700 font-medium text-[15px]">Developer Features</span>
                <span className="text-[12px] text-slate-400">IOI Preparation Module</span>
              </div>
            </div>
            <button 
              onClick={toggleIoiPrep}
              className={`px-4 py-2 text-[13px] font-semibold rounded-lg transition-all ${isIoiEnabled ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
            >
              {isIoiEnabled ? 'Disable' : 'Unlock'}
            </button>
          </div>

          <div className="h-[1px] w-full bg-slate-100 my-1"></div>

          <div className="flex justify-between items-center hover:bg-red-50 p-4 rounded-[1rem] transition-all cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="text-slate-400 group-hover:text-red-500 transition-colors">
                <RefreshCw size={20} />
              </div>
              <div className="flex flex-col">
                <span className="text-slate-700 font-medium text-[15px] group-hover:text-red-600 transition-colors">Erase Workspace</span>
                <span className="text-[12px] text-slate-400">Permanently delete all progress</span>
              </div>
            </div>
            <button 
              onClick={handleHardReset}
              className="text-[13px] font-semibold text-slate-400 hover:text-red-600 transition-colors"
            >
              Reset
            </button>
          </div>

          <div className="h-[1px] w-full bg-slate-100 my-1"></div>

          <div className="flex justify-between items-center hover:bg-slate-50 p-4 rounded-[1rem] transition-all cursor-pointer" onClick={handleLogout}>
            <div className="flex items-center gap-4">
              <div className="text-slate-400">
                <LogOut size={20} />
              </div>
              <span className="text-slate-700 font-medium text-[15px]">Sign out</span>
            </div>
          </div>
        </div>
        
        <div className="pt-8 pb-4 flex justify-center">
           <div className="flex items-center gap-3 text-[11px] font-medium text-slate-400 uppercase tracking-widest">
             <span>v2.0</span>
             <span className="text-slate-300">•</span>
             <span>© {new Date().getFullYear()} Rudro Sarkar</span>
           </div>
        </div>

      </div>
    </div>
  );
}