import React from 'react';

export default function ProgressBar({ progress, label }) {
  // Progress jeno 0 theke 100 er moddhei thake seta ensure kora
  const validProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="w-full my-2">
      {label && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-black font-extrabold text-sm">{label}</span>
          <span className="text-black font-extrabold text-sm">{validProgress}%</span>
        </div>
      )}
      
      {/* Track: Light blue/grey glassmorphism */}
      <div className="w-full bg-blue-100/50 backdrop-blur-sm border border-black/10 rounded-full h-4 shadow-inner overflow-hidden">
        
        {/* Fill: Solid Black */}
        <div 
          className="bg-black h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${validProgress}%` }}
        />
        
      </div>
    </div>
  );
}