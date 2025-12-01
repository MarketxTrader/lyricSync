import React, { useState, useEffect } from 'react';

const TranscriptDisplay = ({ transcript, isLoading, onAnalyze, fileName }) => {
  const [content, setContent] = useState('');

  useEffect(() => {
    if (transcript) {
      setContent(transcript);
    } else {
      setContent('');
    }
  }, [transcript]);

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lyrics.lrc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    // Could add toast here
  };

  return (
    <div className="bg-brand-surface border border-gray-700 rounded-2xl shadow-xl flex flex-col h-[500px] overflow-hidden relative">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-900/50">
        <span className="text-xs font-bold tracking-wider text-gray-500 uppercase">LRC Editor</span>
        <div className="flex gap-2">
           <button 
             onClick={handleCopy}
             disabled={isLoading || !content}
             className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed" 
             title="Copy"
           >
             <i className="fas fa-copy"></i>
           </button>
           <button 
             onClick={handleDownload}
             disabled={isLoading || !content}
             className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed" 
             title="Download LRC"
           >
             <i className="fas fa-download"></i>
           </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 relative bg-brand-dark/50">
        {isLoading ? (
           <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 space-y-4">
             <div className="space-y-2 w-3/4 max-w-sm">
                <div className="h-2 bg-gray-700 rounded animate-pulse"></div>
                <div className="h-2 bg-gray-700 rounded animate-pulse w-5/6"></div>
                <div className="h-2 bg-gray-700 rounded animate-pulse w-4/6"></div>
             </div>
             <p className="text-sm animate-pulse text-brand-primary">Analyzing audio & synchronizing lyrics...</p>
           </div>
        ) : !content ? (
           <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
             <div className="w-16 h-16 bg-brand-primary/10 text-brand-primary rounded-2xl flex items-center justify-center mb-4">
               <i className="fas fa-magic text-2xl"></i>
             </div>
             <h3 className="text-xl font-bold text-white mb-2">Ready to Transcribe</h3>
             <p className="text-gray-400 mb-6 text-sm max-w-xs">
               Generate synchronized lyrics for <span className="text-gray-300 font-medium block mt-1 truncate">"{fileName || 'your track'}"</span>
             </p>
             <button 
               onClick={onAnalyze}
               className="px-8 py-3 bg-brand-primary hover:bg-brand-accent text-white rounded-xl font-semibold shadow-lg shadow-brand-primary/25 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
             >
               <i className="fas fa-wave-square"></i>
               <span>Generate Lyrics</span>
             </button>
           </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full bg-transparent resize-none p-6 font-mono text-sm leading-relaxed text-gray-300 focus:outline-none focus:ring-0 selection:bg-brand-primary/30"
            placeholder="[00:00.00] Lyrics will appear here..."
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
};

export default TranscriptDisplay;