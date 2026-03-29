import React, { useState } from 'react';
import { initialData } from '../data/initialData';
import { Check, ChevronRight, ChevronDown, Code } from 'lucide-react';

export default function IOIPrep() {
  // Progress track korar state (Pore Supabase theke fetch hobe)
  const [ioiProgress, setIoiProgress] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});

  const toggleExpand = (catIndex) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catIndex]: !prev[catIndex]
    }));
  };

  // Button click handle korar function
  const handleActionClick = (categoryIndex, topicIndex, actionType) => {
    setIoiProgress(prev => {
      const currentProgress = prev[categoryIndex]?.[topicIndex] || { theory: false, practice: false, upsolve: false, mastered: false, isDone: false };
      
      // Ekbar done hoye gele ar change hobe na
      if (currentProgress.isDone) return prev;

      const updatedProgress = { ...currentProgress, [actionType]: true };
      
      // 4 ta dhap complete hole permanent Done
      if (updatedProgress.theory && updatedProgress.practice && updatedProgress.upsolve && updatedProgress.mastered) {
        updatedProgress.isDone = true;
      }

      return {
        ...prev,
        [categoryIndex]: {
          ...prev[categoryIndex],
          [topicIndex]: updatedProgress
        }
      };
    });
  };

  // Category wise progress calculate korar function
  const calculateProgress = (categoryIndex, totalTopics) => {
    if (!ioiProgress[categoryIndex]) return 0;
    
    let completedCount = 0;
    for (let i = 0; i < totalTopics; i++) {
      if (ioiProgress[categoryIndex][i]?.isDone) {
        completedCount++;
      }
    }
    return Math.round((completedCount / totalTopics) * 100);
  };

  return (
    <div className="pt-6 pb-24 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto space-y-6 px-2">
        
        {/* Header matching Syllabus */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">IOI Preparation</h1>
          <p className="text-slate-500 font-normal mt-2">Track your progress and master competitive programming.</p>
        </div>

        <div className="space-y-4">
          {initialData.ioi.categories.map((category, catIndex) => {
            const progressPercentage = calculateProgress(catIndex, category.topics.length);
            const isExpanded = expandedCategories[catIndex];

            return (
              <div key={catIndex} className="bg-sky-50/40 backdrop-blur-2xl border border-sky-100/60 shadow-sm rounded-3xl overflow-hidden transition-all duration-300">
                
                {/* Accordion Header */}
                <div 
                  onClick={() => toggleExpand(catIndex)}
                  className="cursor-pointer p-5 sm:p-6 flex justify-between items-center hover:bg-white/40 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl transition-colors ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-white border border-sky-100 text-slate-400'}`}>
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </div>
                    <div className="flex items-center gap-2">
                      <Code size={18} className="text-slate-400 hidden sm:block" />
                      <h2 className="text-xl font-medium text-slate-800">{category.name}</h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-20 sm:w-32 h-2 bg-sky-100 rounded-full overflow-hidden hidden sm:block shadow-inner">
                       <div className="h-full bg-green-500 transition-all duration-1000 ease-out" style={{ width: `${progressPercentage}%` }} />
                    </div>
                    <span className={`text-sm font-medium px-3 py-1.5 rounded-lg border ${progressPercentage === 100 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-green-600 border-green-100'}`}>
                      {progressPercentage}%
                    </span>
                  </div>
                </div>

                {/* Topics List (Accordion Body) */}
                {isExpanded && (
                  <div className="p-5 sm:p-6 pt-0 border-t border-sky-100/50 mt-2 bg-white/20">
                    <div className="space-y-3 mt-4">
                      {category.topics.map((topic, topicIndex) => {
                        const topicProgress = ioiProgress[catIndex]?.[topicIndex] || {};
                        const isDone = topicProgress.isDone;

                        return (
                          <div key={topicIndex} className="bg-white border border-sky-50 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-sm hover:border-sky-100 transition-all">
                            
                            <span className={`text-sm font-normal ${isDone ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                              <span className="text-slate-400 mr-2">{topicIndex + 1}.</span> {topic}
                            </span>
                            
                            {isDone ? (
                              <div className="text-xs font-medium bg-green-50 text-green-600 px-3 py-1.5 rounded-lg border border-green-100 flex items-center gap-1">
                                <Check size={14} /> DONE
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {['theory', 'practice', 'upsolve', 'mastered'].map((action) => (
                                  <button 
                                    key={action}
                                    onClick={() => handleActionClick(catIndex, topicIndex, action)}
                                    className={`px-3 py-1.5 text-xs font-medium uppercase tracking-wide rounded-lg transition-all shadow-sm ${topicProgress[action] ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-transparent text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-700'}`}
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