import React, { useRef, useState } from 'react';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

const AudioRecorder: React.FC<FileUploaderProps> = ({ onFileSelect, isLoading }) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndUpload(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndUpload(e.target.files[0]);
    }
  };

  const validateAndUpload = (file: File) => {
    if (isLoading) return;
    
    if (!file.type.startsWith('audio/')) {
      alert("Please upload an audio file.");
      return;
    }
    // 20MB limit
    if (file.size > 20 * 1024 * 1024) {
      alert("File is too large. Max 20MB.");
      return;
    }
    onFileSelect(file);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div 
        className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl transition-all duration-300 ease-in-out
          ${dragActive 
            ? 'border-brand-primary bg-brand-primary/10 scale-[1.02]' 
            : 'border-gray-600 bg-brand-surface hover:border-gray-500'
          } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDrag} 
        onDragLeave={handleDrag} 
        onDragOver={handleDrag} 
        onDrop={handleDrop}
      >
        <input 
          ref={inputRef}
          type="file" 
          className="hidden" 
          onChange={handleChange}
          accept="audio/*"
        />

        {isLoading ? (
          <div className="flex flex-col items-center space-y-4 animate-pulse">
             <div className="w-16 h-16 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
             <p className="text-lg font-medium text-brand-primary">Analyzing Audio...</p>
          </div>
        ) : (
          <>
            <div className="w-20 h-20 mb-4 rounded-full bg-gray-800 flex items-center justify-center shadow-lg">
              <i className="fas fa-cloud-upload-alt text-4xl text-brand-accent"></i>
            </div>
            
            <p className="text-xl font-semibold text-gray-200 mb-2">
              Drag & Drop Audio File
            </p>
            <p className="text-sm text-gray-400 mb-6">
              MP3, WAV, AAC (Max 20MB)
            </p>

            <button 
              onClick={() => inputRef.current?.click()}
              className="px-6 py-2.5 bg-brand-primary hover:bg-brand-accent text-white rounded-lg font-medium transition-colors shadow-lg shadow-brand-primary/25 flex items-center gap-2"
            >
              <i className="fas fa-folder-open"></i>
              Choose File
            </button>
          </>
        )}
      </div>
      
      {/* Helper Features List */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
           <div className="flex items-center gap-3 mb-2">
             <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                <i className="fas fa-music"></i>
             </div>
             <h3 className="font-semibold text-gray-200">How It Works</h3>
           </div>
           <ul className="text-sm text-gray-400 space-y-1 ml-1">
             <li>• AI listens to the audio track.</li>
             <li>• Transcribes lyrics (multilingual).</li>
             <li>• Synchronizes timestamps [mm:ss.xx].</li>
           </ul>
        </div>
        <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
           <div className="flex items-center gap-3 mb-2">
             <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                <i className="fas fa-file-code"></i>
             </div>
             <h3 className="font-semibold text-gray-200">Export Formats</h3>
           </div>
           <p className="text-sm text-gray-400">
             Generate standard LRC files compatible with most karaoke and music players instantly.
           </p>
        </div>
      </div>
    </div>
  );
};

export default AudioRecorder;