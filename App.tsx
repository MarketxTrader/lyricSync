import React, { useState, useCallback } from 'react';
import AudioRecorder from './components/AudioRecorder'; // Acts as File Uploader
import TranscriptDisplay from './components/TranscriptDisplay'; // Acts as LRC Editor
import PlayerCard from './components/PlayerCard';
import { AppState } from './types';
import { transcribeAudio } from './services/geminiService';

const App = () => {
  const [appState, setAppState] = useState(AppState.IDLE);
  const [transcript, setTranscript] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [currentFile, setCurrentFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleFileSelect = useCallback((file) => {
    // Reset previous state
    setTranscript(null);
    setErrorMessage(null);
    setAppState(AppState.IDLE);
    
    // Set new file
    setCurrentFile(file);
    
    // Create Audio URL for the player
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
  }, []);

  const handleAnalyze = async () => {
    if (!currentFile) return;

    setAppState(AppState.PROCESSING);
    setErrorMessage(null);

    try {
      // Process file to base64
      const reader = new FileReader();
      reader.readAsDataURL(currentFile);
      
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;
          // Extract base64 part
          const base64Data = base64String.split(',')[1];
          
          if (!base64Data) throw new Error("Failed to read file data");

          // Call Gemini
          const result = await transcribeAudio(base64Data, currentFile.type || 'audio/mp3');
          setTranscript(result);
          setAppState(AppState.READY);
        } catch (err) {
          console.error(err);
          setErrorMessage(err.message || "Transcription failed");
          setAppState(AppState.ERROR);
        }
      };
      
      reader.onerror = () => {
        setErrorMessage("Failed to read the file.");
        setAppState(AppState.ERROR);
      };
    } catch (err) {
      setErrorMessage("Could not process file.");
      setAppState(AppState.ERROR);
    }
  };

  const resetApp = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setTranscript(null);
    setCurrentFile(null);
    setAppState(AppState.IDLE);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-brand-dark text-gray-100 flex flex-col font-sans">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-gray-800 bg-brand-dark/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center shadow-lg shadow-brand-primary/20">
            <i className="fas fa-music text-white text-sm"></i>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">LyricSync AI</h1>
        </div>
        <div className="flex items-center gap-4">
           <span className="hidden md:inline-block px-3 py-1 rounded-full bg-gray-800 border border-gray-700 text-xs text-gray-400">
             Powered by Gemini 2.5 Flash
           </span>
           <a 
             href="https://github.com" 
             target="_blank" 
             rel="noopener noreferrer"
             className="text-gray-400 hover:text-white transition-colors"
             aria-label="View on GitHub"
           >
             <i className="fab fa-github text-xl"></i>
           </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-6 md:p-10 flex flex-col justify-center">
        
        {/* Error Notification */}
        {errorMessage && (
           <div className="w-full mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-3 animate-fade-in-up">
             <i className="fas fa-exclamation-triangle"></i>
             <p className="text-sm font-medium">{errorMessage}</p>
             <button onClick={() => setErrorMessage(null)} className="ml-auto hover:text-white"><i className="fas fa-times"></i></button>
           </div>
        )}

        {/* View Switcher based on State */}
        {!currentFile ? (
          // Empty State: Uploader
          <div className="animate-fade-in-up">
            <div className="text-center mb-10">
               <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                 Generate synchronized lyrics instantly.
               </h2>
               <p className="text-gray-400 max-w-xl mx-auto text-lg">
                 Upload your audio track and let our AI create precise, timestamped lyrics in LRC format.
               </p>
            </div>
            <AudioRecorder 
              onFileSelect={handleFileSelect}
              isLoading={appState === AppState.PROCESSING}
            />
          </div>
        ) : (
          // Dashboard State: Player + Editor
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in-up">
            
            {/* Left Column: Player & Info */}
            <div className="lg:col-span-5 space-y-6">
               <PlayerCard 
                 file={currentFile} 
                 audioUrl={audioUrl} 
                 onChangeFile={resetApp}
               />
               
               {/* How it works (small version) */}
               <div className="bg-brand-surface/50 border border-gray-800 rounded-xl p-6">
                 <h4 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Instructions</h4>
                 <ul className="text-sm text-gray-500 space-y-2">
                   <li className="flex gap-2"><i className="fas fa-check text-brand-primary mt-1"></i> Click <strong>Generate Lyrics</strong> to start.</li>
                   <li className="flex gap-2"><i className="fas fa-check text-brand-primary mt-1"></i> Review the auto-generated lyrics.</li>
                   <li className="flex gap-2"><i className="fas fa-check text-brand-primary mt-1"></i> Edit timestamps if needed.</li>
                   <li className="flex gap-2"><i className="fas fa-check text-brand-primary mt-1"></i> Click download to save as .lrc file.</li>
                 </ul>
               </div>
            </div>

            {/* Right Column: Editor */}
            <div className="lg:col-span-7">
               <TranscriptDisplay 
                 transcript={transcript} 
                 isLoading={appState === AppState.PROCESSING}
                 onAnalyze={handleAnalyze}
                 fileName={currentFile.name}
               />
            </div>

          </div>
        )}

      </main>
    </div>
  );
};

export default App;