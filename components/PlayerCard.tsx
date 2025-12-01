import React, { useState, useRef, useEffect } from 'react';

interface PlayerCardProps {
  file: File | null;
  audioUrl: string | null;
  onChangeFile: () => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ file, audioUrl, onChangeFile }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const time = parseFloat(e.target.value);
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-brand-surface border border-gray-700 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      {/* Background Gradient Blob */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-6">
           <div className="flex-1 min-w-0 pr-4">
             <h2 className="text-xl font-bold text-white truncate" title={file?.name}>
               {file?.name.replace(/\.[^/.]+$/, "") || "Unknown Track"}
             </h2>
             <p className="text-sm text-gray-400 truncate">
               {file?.type.split('/')[1].toUpperCase() || "AUDIO"} • {(file?.size ? (file.size / 1024 / 1024).toFixed(2) : "0")} MB
             </p>
           </div>
           <button 
             onClick={onChangeFile}
             className="text-xs font-medium text-gray-400 hover:text-white transition-colors"
           >
             Change File
           </button>
        </div>

        {/* Custom Audio Logic */}
        <audio
          ref={audioRef}
          src={audioUrl || undefined}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />

        {/* Progress Bar */}
        <div className="mb-6 group">
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-primary hover:accent-brand-accent transition-all"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-2 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             <button 
               onClick={togglePlay}
               className="w-12 h-12 flex items-center justify-center rounded-full bg-white text-brand-dark hover:scale-105 transition-transform shadow-lg shadow-white/10"
             >
               <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-lg`}></i>
             </button>
             
             {/* Simple Volume Toggle */}
             <button 
                onClick={() => setVolume(volume === 0 ? 1 : 0)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
             >
               <i className={`fas ${volume === 0 ? 'fa-volume-mute' : 'fa-volume-up'}`}></i>
             </button>
          </div>

          <div className="flex gap-2">
             <button className="w-10 h-10 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors flex items-center justify-center">
               <i className="fas fa-ellipsis-v"></i>
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerCard;
