import React, { forwardRef } from 'react';

interface VideoFeedProps {
  isConnecting: boolean;
  isConnected: boolean;
  isVideoEnabled: boolean;
}

export const VideoFeed = forwardRef<HTMLVideoElement, VideoFeedProps>(
  ({ isConnecting, isConnected, isVideoEnabled }, ref) => {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <video
          ref={ref}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            isConnected && isVideoEnabled ? 'opacity-100' : 'opacity-30'
          }`}
          style={{ transform: 'scaleX(-1)' }} // Mirror effect
        />
        
        {/* Placeholder Icon when video is off or connecting */}
        {(!isVideoEnabled || !isConnected) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             {isConnecting ? (
               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sudan-500"></div>
             ) : (
                <span className="text-zinc-700 text-6xl">📷</span>
             )}
          </div>
        )}
        
        {/* Live Indicator */}
        {isConnected && (
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-bold text-green-500 tracking-wider">LIVE</span>
            </div>
        )}
      </div>
    );
  }
);

VideoFeed.displayName = 'VideoFeed';