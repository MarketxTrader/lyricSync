import React, { useState, useCallback, useRef } from 'react';
import { getAuth, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { initializeApp } from 'firebase/app';

// --- Global Setup for Firebase (Mandatory for Canvas Environment) ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; // Used for structuring firestore

// Initialize Firebase App
const firebaseApp = firebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = firebaseApp ? getAuth(firebaseApp) : null;
// --- End Firebase Setup ---

// --- Configuration and Types ---

// API Configuration
const GEMINI_API_KEY = ""; // Canvas will provide this
const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025";

const AppState = {
  IDLE: 'IDLE',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  ERROR: 'ERROR',
};

// Utility to convert time in seconds to [mm:ss.xx] format
const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const milliseconds = Math.floor((timeInSeconds - Math.floor(timeInSeconds)) * 100);
    
    const pad = (num, len = 2) => String(num).padStart(len, '0');

    return `[${pad(minutes)}:${pad(seconds)}.${pad(milliseconds, 2)}]`;
};

// --- LRC Utility Functions ---
const parseLrc = (lrcContent) => {
    if (!lrcContent) return [];
    
    // Regex to match timestamp format [mm:ss.xx] or [mm:ss]
    const lineRegex = /(\[\d{2}:\d{2}(?:\.\d{1,3})?\])(.*)/;
    const lines = lrcContent.split('\n');
    
    return lines
        .map(line => {
            const match = line.trim().match(lineRegex);
            if (match) {
                const timestampStr = match[1].slice(1, -1); // Remove brackets
                const text = match[2].trim();
                
                // Convert timestamp string (mm:ss.xx) to seconds
                const [minutes, rest] = timestampStr.split(':');
                const [seconds, milliseconds] = rest.split('.');
                
                const timeInSeconds = 
                    (parseInt(minutes, 10) * 60) + 
                    parseInt(seconds, 10) + 
                    (parseInt(milliseconds || '0', 10) / (milliseconds?.length === 3 ? 1000 : 100));

                return {
                    timestamp: timeInSeconds,
                    text: text,
                    lrcTime: match[1]
                };
            }
            return null;
        })
        .filter(Boolean)
        .sort((a, b) => a.timestamp - b.timestamp);
};

const formatLrc = (parsedLines) => {
    return parsedLines
        .map(line => `${line.lrcTime}${line.text}`)
        .join('\n');
};

// --- Gemini Service Implementation ---

/**
 * Calls the Gemini API to transcribe the provided base64 audio data.
 * The model is instructed to return the transcription in LRC format with timestamps.
 * Implements exponential backoff for retries.
 */
const transcribeAudio = async (base64AudioData, mimeType, maxRetries = 5) => {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    
    const systemPrompt = `You are an expert audio transcription system. Transcribe the entire audio file provided. You MUST output the transcription in the LRC (Lyric) format. 
    
    LRC format rules:
    - Every line must start with a time tag in the format [mm:ss.xx], where mm is minutes, ss is seconds, and xx are hundredths of a second.
    - Do not include any metadata tags like [ar:], [ti:], etc.
    - If there is a pause, use an empty line with a timestamp.
    - Only output the raw LRC text. Do not include any conversational text, explanations, or markdown fences (e.g., \`\`\`lrc).`;

    const userQuery = "Please transcribe the attached audio recording and format the output strictly as raw LRC lyrics file content.";

    const payload = {
        contents: [
            {
                role: "user",
                parts: [
                    { text: userQuery },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64AudioData
                        }
                    }
                ]
            }
        ],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
    };

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.status === 429 && i < maxRetries - 1) {
                const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                // console.log(`Rate limit hit. Retrying in ${delay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(errorBody.error?.message || `API request failed with status ${response.status}`);
            }

            const result = await response.json();
            
            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                throw new Error("Received an empty response from the AI model.");
            }
            
            // Clean up the text: remove markdown fences and unnecessary wrappers
            const cleanedText = text.replace(/```lrc\s*|\s*```/g, '').trim();

            return cleanedText;

        } catch (error) {
            if (i === maxRetries - 1) {
                throw new Error(`Failed to transcribe audio after ${maxRetries} attempts: ${error.message}`);
            }
        }
    }
    throw new Error("Unknown error during transcription process.");
};


// --- Component Implementations ---

/**
 * PlayerCard Component: Displays file info and manages the audio player element.
 */
const PlayerCard = ({ file, audioUrl, onChangeFile }) => {
    const audioRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    const togglePlayPause = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play().catch(e => console.error("Playback failed:", e));
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
    };

    const handleSeek = (e) => {
        if (audioRef.current) {
            audioRef.current.currentTime = e.target.value;
            setCurrentTime(e.target.value);
        }
    };

    return (
        <div className="bg-brand-surface/50 border border-gray-800 rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                <div className="flex flex-col">
                    <h3 className="text-lg font-semibold text-white truncate max-w-full">{file.name}</h3>
                    <p className="text-xs text-gray-500">{formatTime(duration).slice(1, -1).split('.')[0]} total</p>
                </div>
                <button
                    onClick={onChangeFile}
                    className="text-sm text-brand-primary hover:text-brand-accent transition-colors font-medium flex items-center gap-1"
                >
                    <i className="fas fa-undo-alt text-xs"></i> Change File
                </button>
            </div>

            <audio
                ref={audioRef}
                src={audioUrl}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                preload="metadata"
                hidden
            />

            <div className="flex items-center space-x-4 pt-2">
                <button
                    onClick={togglePlayPause}
                    disabled={!audioUrl}
                    className="p-4 rounded-full bg-brand-primary text-white hover:bg-brand-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-primary/30 transform hover:scale-105"
                >
                    <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-xl`}></i>
                </button>

                <div className="flex-1 min-w-0">
                    <input
                        type="range"
                        min="0"
                        max={duration}
                        value={currentTime}
                        onChange={handleSeek}
                        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer range-lg [&::-webkit-slider-thumb]:bg-brand-primary [&::-moz-range-thumb]:bg-brand-primary"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{formatTime(currentTime).slice(1, -1)}</span>
                        <span>{formatTime(duration).slice(1, -1)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * AudioRecorder Component: Handles file upload/selection.
 */
const AudioRecorder = ({ onFileSelect, isLoading }) => {
    const fileInputRef = useRef(null);

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isLoading) return;
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('audio/')) {
                onFileSelect(file);
            }
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            onFileSelect(e.target.files[0]);
        }
    };

    const preventDefaults = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    return (
        <div 
            className={`w-full p-8 md:p-12 border-4 border-dashed rounded-3xl transition-all duration-300 
                ${isLoading ? 'border-gray-700 bg-gray-900/50' : 'border-brand-primary/50 hover:border-brand-primary hover:bg-brand-primary/10 cursor-pointer'}`}
            onDrop={handleDrop}
            onDragOver={preventDefaults}
            onDragEnter={preventDefaults}
            onClick={() => !isLoading && fileInputRef.current?.click()}
        >
            <input 
                type="file" 
                ref={fileInputRef} 
                accept="audio/*" 
                onChange={handleFileChange} 
                className="hidden"
            />
            
            <div className="flex flex-col items-center justify-center text-center">
                <i className={`fas fa-cloud-upload-alt text-4xl mb-4 ${isLoading ? 'text-gray-500' : 'text-brand-primary'}`}></i>
                <p className="text-white font-semibold text-lg mb-1">
                    {isLoading ? "Processing file..." : "Drag & Drop your audio file here"}
                </p>
                <p className="text-gray-400 text-sm mb-4">
                    MP3, WAV, M4A, etc. (Max size 10MB recommended)
                </p>
                <button
                    type="button"
                    disabled={isLoading}
                    className="px-6 py-2 bg-brand-primary text-white font-bold rounded-full transition-all duration-200 shadow-md hover:bg-brand-accent disabled:opacity-50"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                >
                    {isLoading ? "Please Wait" : "Browse Files"}
                </button>
            </div>
        </div>
    );
};

/**
 * TranscriptDisplay Component: Acts as the LRC editor and download interface.
 */
const TranscriptDisplay = ({ transcript, isLoading, onAnalyze, fileName }) => {
    const [editableTranscript, setEditableTranscript] = useState(transcript || '');
    
    // Update editableTranscript when the main transcript prop changes
    React.useEffect(() => {
        setEditableTranscript(transcript || '');
    }, [transcript]);

    const handleDownload = () => {
        if (!editableTranscript) return;

        const blob = new Blob([editableTranscript], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        // Use the original filename but change the extension to .lrc
        const lrcFileName = fileName.replace(/\.[^/.]+$/, "") + ".lrc"; 
        link.setAttribute('download', lrcFileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const renderLrcPreview = () => {
        const lines = parseLrc(editableTranscript);
        return (
            <div className="space-y-2 max-h-96 overflow-y-auto p-4 bg-gray-900 rounded-lg border border-gray-800">
                {lines.map((line, index) => (
                    <div key={index} className="flex gap-4 text-sm hover:bg-gray-800/50 p-1 rounded transition-colors">
                        <span className="text-gray-500 font-mono w-20 flex-shrink-0">{line.lrcTime}</span>
                        <span className="text-gray-300 flex-1">{line.text}</span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="bg-brand-surface/50 border border-gray-800 rounded-xl p-6 shadow-xl space-y-6 h-full flex flex-col">
            <h3 className="text-xl font-bold text-white border-b border-gray-800 pb-4 flex justify-between items-center">
                <span>Lyrics Editor (LRC Format)</span>
                {transcript && (
                     <button 
                        onClick={handleDownload}
                        className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-500 transition-colors shadow-lg shadow-green-600/30 flex items-center gap-2"
                        aria-label="Download LRC File"
                    >
                        <i className="fas fa-download"></i> Download LRC
                    </button>
                )}
            </h3>

            {isLoading && (
                <div className="flex flex-col items-center justify-center h-48 text-brand-primary animate-pulse">
                    <i className="fas fa-compact-disc text-4xl mb-3 animate-spin"></i>
                    <p className="text-lg font-medium">Generating Timestamps...</p>
                    <p className="text-sm text-gray-500 mt-1">This may take a moment depending on file size.</p>
                </div>
            )}

            {!transcript && !isLoading && (
                <div className="flex flex-col items-center justify-center h-48">
                    <p className="text-gray-400 mb-6 text-center">
                        Click the button below to send your audio file for AI transcription and timestamp generation.
                    </p>
                    <button
                        onClick={onAnalyze}
                        className="px-8 py-3 bg-brand-primary text-white text-lg font-bold rounded-full transition-all duration-200 shadow-xl hover:bg-brand-accent transform hover:scale-[1.02] active:scale-95 flex items-center gap-2"
                    >
                        <i className="fas fa-wand-magic-sparkles"></i> Generate Lyrics
                    </button>
                </div>
            )}

            {transcript && !isLoading && (
                <>
                    <div className="flex-1 min-h-32">
                        <textarea
                            value={editableTranscript}
                            onChange={(e) => setEditableTranscript(e.target.value)}
                            className="w-full h-full p-4 bg-gray-900 border border-gray-800 rounded-lg font-mono text-sm text-gray-200 focus:ring-brand-primary focus:border-brand-primary transition-colors resize-none"
                            rows="10"
                            placeholder="[00:00.00] Edit your LRC formatted lyrics here..."
                        />
                    </div>
                    
                    <details className="group">
                        <summary className="cursor-pointer text-sm font-semibold text-gray-300 hover:text-white transition-colors flex items-center justify-between py-2 border-t border-gray-800">
                            <span>Preview LRC Format</span>
                            <i className="fas fa-chevron-down transform group-open:rotate-180 transition-transform"></i>
                        </summary>
                        {renderLrcPreview()}
                    </details>
                </>
            )}
        </div>
    );
};


// --- Main Application Component ---

const App = () => {
  const [appState, setAppState] = useState(AppState.IDLE);
  const [transcript, setTranscript] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [currentFile, setCurrentFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const audioUrlRef = useRef(null); // Ref to hold previous audioUrl for cleanup

  // 1. Firebase Authentication on load
  React.useEffect(() => {
    if (auth) {
        if (initialAuthToken) {
            signInWithCustomToken(auth, initialAuthToken).catch(console.error);
        } else {
            signInAnonymously(auth).catch(console.error);
        }
    }
  }, []);

  // 2. Cleanup function for Object URL
  React.useEffect(() => {
    audioUrlRef.current = audioUrl;
    return () => {
        if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
        }
    };
  }, [audioUrl]);


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
      
      // Use a Promise wrapper for FileReader for async/await cleanliness
      const base64DataPromise = new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const base64String = reader.result;
          const base64Part = base64String.split(',')[1];
          if (base64Part) {
            resolve(base64Part);
          } else {
            reject(new Error("Failed to read file data."));
          }
        };
        
        reader.onerror = () => {
          reject(new Error("Failed to read the file."));
        };
      });
      
      const base64Data = await base64DataPromise;

      // Call Gemini
      const result = await transcribeAudio(base64Data, currentFile.type || 'audio/mp3');
      setTranscript(result);
      setAppState(AppState.READY);
    } catch (err) {
      console.error("Transcription Error:", err);
      setErrorMessage(err.message || "Transcription failed. Please check file type and size.");
      setAppState(AppState.ERROR);
    }
  };

  const resetApp = () => {
    setAudioUrl(null);
    setTranscript(null);
    setCurrentFile(null);
    setAppState(AppState.IDLE);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#111827] text-gray-100 flex flex-col font-inter">
      <style>{`
        /* Custom Tailwind Color Palette based on original component names */
        .bg-brand-dark { background-color: #111827; }
        .bg-brand-surface { background-color: #1F2937; }
        .bg-brand-primary { background-color: #4F46E5; } /* Indigo 600 */
        .hover\\:bg-brand-accent:hover { background-color: #6366F1; } /* Indigo 500 */
        .text-brand-primary { color: #4F46E5; }
        .text-brand-accent { color: #6366F1; }
        .border-brand-primary\\/50 { border-color: rgba(79, 70, 229, 0.5); }
        .shadow-brand-primary\\/20 { box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.1), 0 2px 4px -2px rgba(79, 70, 229, 0.1); }

        /* Animation for subtle entry */
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
            animation: fadeIn 0.6s ease-out;
        }

        /* Custom range slider styling for aesthetics */
        input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #4F46E5;
            cursor: pointer;
            box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.2);
        }
        input[type="range"]::-moz-range-thumb {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #4F46E5;
            cursor: pointer;
            box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.2);
            border: none;
        }
      `}</style>
      
      {/* Load Font Awesome Icons */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />


      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-gray-800 bg-brand-dark/50 backdrop-blur-md sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-primary to-[#EC4899] flex items-center justify-center shadow-lg shadow-brand-primary/40">
            <i className="fas fa-headphones-simple text-white text-sm"></i>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">LyricSync AI</h1>
        </div>
        <div className="flex items-center gap-4">
           <span className="hidden md:inline-block px-3 py-1 rounded-full bg-gray-800 border border-gray-700 text-xs text-gray-400">
             Powered by Gemini 2.5 Flash
           </span>
           <a 
             href="#" 
             className="text-gray-400 hover:text-white transition-colors"
             aria-label="View on GitHub"
           >
             <i className="fab fa-github text-xl"></i>
           </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-6 md:p-10 flex flex-col justify-center">
        
        {/* Error Notification */}
        {errorMessage && (
           <div className="w-full mb-8 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl flex items-start gap-4 animate-fade-in-up shadow-lg">
             <i className="fas fa-exclamation-triangle mt-1 text-lg flex-shrink-0"></i>
             <div className="flex-1">
                 <p className="text-sm font-semibold mb-1">Error Occurred</p>
                 <p className="text-sm">{errorMessage}</p>
             </div>
             <button onClick={() => setErrorMessage(null)} className="hover:text-white flex-shrink-0 p-1"><i className="fas fa-times"></i></button>
           </div>
        )}

        {/* View Switcher based on State */}
        {!currentFile ? (
          // Empty State: Uploader
          <div className="animate-fade-in-up">
            <div className="text-center mb-12">
               <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
                 Generate synchronized lyrics instantly.
               </h2>
               <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                 Upload your audio track and let our AI create precise, timestamped lyrics in LRC format, ready for editing and download.
               </p>
            </div>
            <AudioRecorder 
              onFileSelect={handleFileSelect}
              isLoading={appState === AppState.PROCESSING}
            />
          </div>
        ) : (
          // Dashboard State: Player + Editor
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in-up">
            
            {/* Left Column: Player & Info */}
            <div className="lg:col-span-5 space-y-8">
               <PlayerCard 
                 file={currentFile} 
                 audioUrl={audioUrl} 
                 onChangeFile={resetApp}
               />
               
               {/* How it works (small version) */}
               <div className="bg-brand-surface/70 border border-gray-800 rounded-xl p-6 shadow-lg">
                 <h4 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider border-b border-gray-800 pb-2">How it Works</h4>
                 <ul className="text-sm text-gray-400 space-y-3">
                   <li className="flex gap-3 items-start"><i className="fas fa-1 text-brand-primary mt-0.5"></i> Click <strong>Generate Lyrics</strong> to analyze audio using Gemini.</li>
                   <li className="flex gap-3 items-start"><i className="fas fa-2 text-brand-primary mt-0.5"></i> The AI returns the transcription with <strong>[mm:ss.xx]</strong> timestamps.</li>
                   <li className="flex gap-3 items-start"><i className="fas fa-3 text-brand-primary mt-0.5"></i> Review and manually adjust timestamps or text in the editor.</li>
                   <li className="flex gap-3 items-start"><i className="fas fa-4 text-brand-primary mt-0.5"></i> Click <strong>Download LRC</strong> to save your synchronized lyrics file.</li>
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