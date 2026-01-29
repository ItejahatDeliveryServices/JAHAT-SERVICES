import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { 
  createPcmBlob, 
  decodeAudioData, 
  base64ToBytes, 
  blobToBase64 
} from '../utils/audioUtils';
import { 
  MODEL_NAME, 
  SUDANESE_SYSTEM_INSTRUCTION, 
  AUDIO_INPUT_SAMPLE_RATE, 
  AUDIO_OUTPUT_SAMPLE_RATE, 
  VIDEO_FRAME_RATE, 
  VIDEO_JPEG_QUALITY 
} from '../constants';
import { VideoFeed } from './VideoFeed';
import { ControlPanel } from './ControlPanel';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export const LiveSession: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [volumeLevel, setVolumeLevel] = useState(0);

  // References for Media and Audio
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const videoIntervalRef = useRef<number | null>(null);
  
  // Audio Gain Node for Volume Boost
  const gainNodeRef = useRef<GainNode | null>(null);
  
  // Gemini Session Reference
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  
  // Audio Playback Source Management
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Cleanup function
  const stopSession = useCallback(() => {
    if (videoIntervalRef.current) {
      window.clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) { /* ignore */ }
    });
    sourcesRef.current.clear();
    
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    gainNodeRef.current = null;

    sessionPromiseRef.current = null;

    setStatus('disconnected');
    setVolumeLevel(0);
  }, []);

  const startSession = async () => {
    // Ensure clean slate
    stopSession();
    setErrorMsg(null);
    setStatus('connecting');

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        throw new Error("API Key is missing. Please check your configuration.");
      }

      // Use v1alpha to access experimental models like gemini-2.0-flash-exp
      const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1alpha' });

      // Initialize Audio Contexts
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: AUDIO_INPUT_SAMPLE_RATE
      });
      await inputAudioContextRef.current.resume();

      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: AUDIO_OUTPUT_SAMPLE_RATE
      });
      // CRITICAL: Must resume output context to allow playback
      await outputAudioContextRef.current.resume();

      // Create Gain Node for volume boost
      gainNodeRef.current = outputAudioContextRef.current.createGain();
      gainNodeRef.current.gain.value = 1.5; // Boost volume by 50%
      gainNodeRef.current.connect(outputAudioContextRef.current.destination);

      // Get Media Stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }, 
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      nextStartTimeRef.current = 0;

      // Initialize Gemini Live Session
      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SUDANESE_SYSTEM_INSTRUCTION, 
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } 
          },
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Session Opened");
            setStatus('connected');
            
            if (!inputAudioContextRef.current || !streamRef.current) return;

            // Setup Audio Processing
            const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
            const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              if (isMuted) return;

              const inputData = e.inputBuffer.getChannelData(0);
              
              // Simple volume meter
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              setVolumeLevel(Math.min(rms * 5, 1));

              const pcmBlob = createPcmBlob(inputData);
              
              sessionPromiseRef.current?.then(session => {
                 session.sendRealtimeInput({ media: pcmBlob });
              }).catch((e) => {
                 // Ignore errors if session is closing
                 console.debug("Send input error (session likely closed):", e);
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current.destination);
            processorRef.current = scriptProcessor;

            startVideoStream();
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            
            if (base64Audio && outputAudioContextRef.current && gainNodeRef.current) {
              const ctx = outputAudioContextRef.current;
              // Sync start time
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              try {
                const audioBytes = base64ToBytes(base64Audio);
                const audioBuffer = await decodeAudioData(audioBytes, ctx, AUDIO_OUTPUT_SAMPLE_RATE);
                
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                // Connect to Gain Node instead of direct destination
                source.connect(gainNodeRef.current);
                
                source.onended = () => {
                  sourcesRef.current.delete(source);
                };
                
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
              } catch (err) {
                console.error("Error decoding audio:", err);
              }
            }

            if (message.serverContent?.interrupted) {
              console.log("Model interrupted");
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: (event) => {
            console.log("Session closed", event);
            stopSession();
          },
          onerror: (err) => {
            console.error("Session error:", err);
            // Don't stop immediately on all errors, but for connection errors we should.
            // Converting to string to check message content if needed, but safe to set error state.
            setErrorMsg("Connection error. Please try again.");
            stopSession();
          }
        }
      });

      sessionPromise.catch((err) => {
        console.error("Connection failed:", err);
        setErrorMsg(err.message || "Failed to connect to Gemini.");
        setStatus('error');
        stopSession();
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Failed to initialize session.");
      setStatus('error');
    }
  };

  const startVideoStream = () => {
    if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);

    videoIntervalRef.current = window.setInterval(() => {
      if (!isVideoEnabled || !videoRef.current || !canvasRef.current) return;

      const videoEl = videoRef.current;
      const canvasEl = canvasRef.current;
      const ctx = canvasEl.getContext('2d');

      if (!ctx || videoEl.videoWidth === 0) return;

      canvasEl.width = videoEl.videoWidth / 2;
      canvasEl.height = videoEl.videoHeight / 2;
      
      ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
      
      canvasEl.toBlob(async (blob) => {
        if (blob) {
          try {
             const base64Data = await blobToBase64(blob);
             sessionPromiseRef.current?.then(session => {
               session.sendRealtimeInput({
                 media: {
                   mimeType: 'image/jpeg',
                   data: base64Data
                 }
               });
             }).catch(() => {
               // Ignore streaming errors
             });
          } catch (e) {
             console.error("Error sending video frame", e);
          }
        }
      }, 'image/jpeg', VIDEO_JPEG_QUALITY);

    }, 1000 / VIDEO_FRAME_RATE);
  };

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => {
        track.enabled = isVideoEnabled;
      });
    }
  }, [isVideoEnabled]);

  return (
    <div className="relative flex flex-col h-full bg-zinc-800 rounded-3xl overflow-hidden shadow-2xl border border-zinc-700">
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        <VideoFeed 
          ref={videoRef} 
          isConnecting={status === 'connecting'} 
          isConnected={status === 'connected'} 
          isVideoEnabled={isVideoEnabled}
        />
        
        <canvas ref={canvasRef} className="hidden" />

        {status === 'disconnected' && (
           <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10">
             <div className="text-center p-6">
               <div className="text-6xl mb-4">🇸🇩</div>
               <h2 className="text-2xl font-bold text-white mb-2">الذكاء السوداني الأصيل</h2>
               <p className="text-zinc-400 mb-4">نزار قباني، غناء، وذكاء 100%</p>
               <div className="inline-block bg-zinc-800 px-4 py-2 rounded-lg text-sm text-sudan-400 border border-sudan-900">
                  🎙️ اضغط للبدء (Zephyr Voice)
               </div>
             </div>
           </div>
        )}

        {status === 'error' && (
           <div className="absolute inset-0 flex items-center justify-center bg-red-900/80 backdrop-blur-sm z-10">
             <div className="text-center p-6 text-white">
               <h2 className="text-xl font-bold mb-2">خطأ في الاتصال</h2>
               <p>{errorMsg}</p>
               <button 
                 onClick={() => setStatus('disconnected')}
                 className="mt-4 px-4 py-2 bg-white text-red-900 rounded-full font-bold"
               >
                 حاول مرة أخرى
               </button>
             </div>
           </div>
        )}
      </div>

      <div className="h-24 bg-zinc-900 border-t border-zinc-800 flex items-center justify-center px-6">
        <ControlPanel 
          status={status}
          onConnect={startSession}
          onDisconnect={stopSession}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted(!isMuted)}
          isVideoEnabled={isVideoEnabled}
          onToggleVideo={() => setIsVideoEnabled(!isVideoEnabled)}
          volumeLevel={volumeLevel}
        />
      </div>
    </div>
  );
};