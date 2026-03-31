import React, { useState, useContext, useEffect } from 'react';
import { BookOpen, CheckCircle, ChevronDown, ChevronRight, GraduationCap, Palette, Check } from 'lucide-react';
import { initialData } from '../data/initialData';
import { ProgressContext } from '../App';

export default function Syllabus() {
  const { syllabusProgress, manuallyUpdateSyllabus } = useContext(ProgressContext);
  
  const [activeGroup, setActiveGroup] = useState(() => {
    return localStorage.getItem('academic_group') || 'science';
  });

  const [expandedSubject, setExpandedSubject] = useState({});

  useEffect(() => {
    localStorage.setItem('academic_group', activeGroup);
    setExpandedSubject({}); 
  }, [activeGroup]);

  const filteredSubjects = Object.entries(initialData.academics).filter(
    ([key, data]) => data.groups && data.groups.includes(activeGroup)
  );

  const toggleSubject = (key) => {
    setExpandedSubject(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const calculateSubjectProgress = (subjectKey, chapters) => {
    if (!chapters || chapters.length === 0) return 0;
    const progress = syllabusProgress[subjectKey] || {};
    const completed = chapters.filter((_, idx) => progress[idx]?.isDone).length;
    return Math.round((completed / chapters.length) * 100);
  };

  const handleActionToggle = (subjectKey, chapterIndex, action) => {
    manuallyUpdateSyllabus(subjectKey, chapterIndex, action);
  };

  // 🧠 DYNAMIC ACTIONS LOGIC based on subject
  const getAvailableActions = (subjectKey) => {
    if (!subjectKey) return ['basic', 'cq', 'mcq', 'mastered'];
    
    const keyLower = subjectKey.toLowerCase();
    
    // English 1st/2nd and ICT: Only basic & mastered
    if (keyLower.includes('english') || keyLower.includes('ict')) {
      return ['basic', 'mastered'];
    }
    // Bangla 2nd: basic, mcq, mastered (NO CQ)
    if (keyLower.includes('bangla_2nd') || keyLower.includes('bangla2')) {
      return ['basic', 'mcq', 'mastered'];
    }
    
    // Default for Math, Physics, Chem, Biology, etc.
    return ['basic', 'cq', 'mcq', 'mastered'];
  };

  return (
    <div className="pt-6 pb-24 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto space-y-6 px-2">
        
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Academic Syllabus</h1>
          <p className="text-slate-500 font-normal mt-2">Track your progress and conquer your curriculum.</p>
        </div>

        <div className="flex bg-white/60 p-1.5 rounded-2xl shadow-inner border border-sky-100 max-w-sm mx-auto backdrop-blur-md mb-6">
          <button 
            onClick={() => setActiveGroup('science')} 
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[14px] text-[14px] font-bold transition-all duration-300 ${activeGroup === 'science' ? 'bg-[#10a37f] text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <GraduationCap size={18} /> Science
          </button>
          <button 
            onClick={() => setActiveGroup('arts')} 
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[14px] text-[14px] font-bold transition-all duration-300 ${activeGroup === 'arts' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Palette size={18} /> Arts
          </button>
        </div>

        <div className="space-y-4">
          {filteredSubjects.map(([key, subject]) => {
            const progressPercentage = calculateSubjectProgress(key, subject.chapters);
            const isExpanded = expandedSubject[key];
            const subjectActions = getAvailableActions(key); // Fetching specific actions for the subject

            return (
              <div key={key} className="bg-sky-50/40 backdrop-blur-2xl border border-sky-100/60 shadow-sm rounded-3xl overflow-hidden transition-all duration-300">
                
                <div 
                  onClick={() => toggleSubject(key)}
                  className="cursor-pointer p-5 sm:p-6 flex justify-between items-center hover:bg-white/40 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl transition-colors ${isExpanded ? 'bg-[#10a37f]/10 text-[#10a37f]' : 'bg-white border border-sky-100 text-slate-400'}`}>
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen size={18} className="text-slate-400 hidden sm:block" />
                      <h2 className="text-xl font-medium text-slate-800">{subject.name}</h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-20 sm:w-32 h-2 bg-sky-100 rounded-full overflow-hidden hidden sm:block shadow-inner">
                       <div className="h-full bg-[#10a37f] transition-all duration-1000 ease-out" style={{ width: `${progressPercentage}%` }} />
                    </div>
                    <span className={`text-sm font-medium px-3 py-1.5 rounded-lg border ${progressPercentage === 100 ? 'bg-[#10a37f]/10 text-[#10a37f] border-[#10a37f]/20' : 'bg-white text-[#10a37f] border-[#10a37f]/20'}`}>
                      {progressPercentage}%
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-5 sm:p-6 pt-0 border-t border-sky-100/50 mt-2 bg-white/20">
                    <div className="space-y-3 mt-4">
                      {subject.chapters.map((chapter, index) => {
                        const chapProgress = syllabusProgress[key]?.[index] || { basic: false, cq: false, mcq: false, mastered: false, isDone: false };
                        const isDone = chapProgress.isDone;

                        return (
                          <div key={index} className="bg-white border border-sky-50 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-sm hover:border-sky-100 transition-all">
                            
                            <span className={`text-sm font-normal ${isDone ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                              <span className="text-slate-400 mr-2">{index + 1}.</span> {chapter}
                            </span>
                            
                            {isDone ? (
                              <div className="text-xs font-medium bg-[#10a37f]/10 text-[#10a37f] px-3 py-1.5 rounded-lg border border-[#10a37f]/20 flex items-center gap-1">
                                <Check size={14} /> DONE
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {/* 🚀 DYNAMIC ACTIONS IMPLEMENTED HERE */}
                                {subjectActions.map((action) => (
                                  <button 
                                    key={action}
                                    onClick={() => handleActionToggle(key, index, action)}
                                    className={`px-3 py-1.5 text-xs font-medium uppercase tracking-wide rounded-lg transition-all shadow-sm ${chapProgress[action] ? 'bg-[#10a37f]/10 text-[#10a37f] border border-[#10a37f]/20' : 'bg-transparent text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-700'}`}
                                  >
                                    {action}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}