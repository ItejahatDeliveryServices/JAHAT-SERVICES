import React from 'react';

interface ControlPanelProps {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  onConnect: () => void;
  onDisconnect: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isVideoEnabled: boolean;
  onToggleVideo: () => void;
  volumeLevel: number;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  status,
  onConnect,
  onDisconnect,
  isMuted,
  onToggleMute,
  isVideoEnabled,
  onToggleVideo,
  volumeLevel,
}) => {
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  return (
    <div className="flex items-center gap-4 sm:gap-6">
      {/* Mute Button */}
      <button
        onClick={onToggleMute}
        disabled={!isConnected}
        className={`relative p-4 rounded-full transition-all duration-200 ${
          isMuted
            ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
            : 'bg-zinc-800 text-white hover:bg-zinc-700'
        } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {isMuted ? (
             <>
               <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
               <line x1="23" y1="9" x2="17" y2="15"></line>
               <line x1="17" y1="9" x2="23" y2="15"></line>
             </>
          ) : (
             <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          )}
        </svg>
        {/* Volume Visualizer Ring */}
        {!isMuted && isConnected && (
            <div 
                className="absolute inset-0 rounded-full border-2 border-sudan-500 transition-all duration-75"
                style={{ 
                    opacity: 0.3 + volumeLevel,
                    transform: `scale(${1 + volumeLevel * 0.3})`
                }}
            />
        )}
      </button>

      {/* Main Connect/Disconnect Button */}
      {isConnected || isConnecting ? (
        <button
          onClick={onDisconnect}
          className="h-16 w-32 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold text-lg shadow-lg shadow-red-900/20 flex items-center justify-center transition-all"
        >
          {isConnecting ? '...' : 'End'}
        </button>
      ) : (
        <button
          onClick={onConnect}
          className="h-16 w-32 bg-sudan-600 hover:bg-sudan-500 text-white rounded-full font-bold text-lg shadow-lg shadow-sudan-900/20 flex items-center justify-center transition-all"
        >
          Start
        </button>
      )}

      {/* Video Toggle Button */}
      <button
        onClick={onToggleVideo}
        disabled={!isConnected}
        className={`p-4 rounded-full transition-all duration-200 ${
          !isVideoEnabled
            ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
            : 'bg-zinc-800 text-white hover:bg-zinc-700'
        } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {isVideoEnabled ? (
             <polygon points="23 7 16 12 23 17 23 7"></polygon>
          ) : (
             <>
               <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path>
               <line x1="1" y1="1" x2="23" y2="23"></line>
             </>
          )}
          {isVideoEnabled && <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>}
        </svg>
      </button>
    </div>
  );
};