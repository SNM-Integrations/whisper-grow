import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { App as CapacitorApp } from '@capacitor/app';

interface VoiceRecorderProps {
  onTranscriptComplete: (text: string) => void;
}

const VoiceRecorder = ({ onTranscriptComplete }: VoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [streamingStatus, setStreamingStatus] = useState<'connected' | 'disconnected' | 'idle'>('idle');
  const [chunksStreamed, setChunksStreamed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<any>(null);
  const startTimeRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const maxRecordingTime = 30 * 60; // 30 minutes in seconds

  // Load persisted session on mount
  useEffect(() => {
    const persistedSession = localStorage.getItem('recording_session');
    if (persistedSession) {
      const session = JSON.parse(persistedSession);
      if (Date.now() - session.timestamp < 3600000) { // 1 hour
        toast.info("Previous recording session found", {
          description: "Resume or start fresh?",
          action: {
            label: "Resume",
            onClick: () => {
              sessionIdRef.current = session.sessionId;
              setRecordingTime(session.duration);
            }
          }
        });
      } else {
        localStorage.removeItem('recording_session');
      }
    }
  }, []);

  const startRecording = async () => {
    try {
      console.log('[VoiceRecorder] Starting recording...');
      
      // Initialize WebSocket streaming
      const sessionId = `session_${Date.now()}`;
      sessionIdRef.current = sessionId;
      setChunksStreamed(0);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        if (token) {
          const wsUrl = `${import.meta.env.VITE_SUPABASE_URL.replace('https://', 'wss://')}/functions/v1/stream-audio-recording?auth=Bearer ${token}`;
          wsRef.current = new WebSocket(wsUrl);
          
          wsRef.current.onopen = () => {
            console.log('[VoiceRecorder] WebSocket connected');
            setStreamingStatus('connected');
            wsRef.current?.send(JSON.stringify({ type: 'start', sessionId }));
          };
          
          wsRef.current.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'chunk_received') {
              setChunksStreamed(data.chunkNumber);
              console.log(`[VoiceRecorder] ${data.chunkNumber} chunks streamed, ${data.totalSize} bytes`);
            }
          };
          
          wsRef.current.onerror = () => {
            console.warn('[VoiceRecorder] WebSocket error - recording locally only');
            setStreamingStatus('disconnected');
          };
          
          wsRef.current.onclose = () => {
            setStreamingStatus('idle');
          };
        }
      } catch (err) {
        console.warn('[VoiceRecorder] WebSocket setup failed, using local recording only:', err);
        setStreamingStatus('disconnected');
      }
      
      // Request wake lock to keep recording active with screen off
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log('[VoiceRecorder] Wake lock acquired - recording will stay active');
        } catch (err) {
          console.warn('[VoiceRecorder] Wake lock failed:', err);
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('[VoiceRecorder] Microphone stream acquired');
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setRecordingTime(0);

      mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          console.log('[VoiceRecorder] Audio chunk received:', e.data.size, 'bytes');
          chunksRef.current.push(e.data);
          
          // Stream chunk to server if WebSocket is connected
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              wsRef.current?.send(JSON.stringify({ type: 'chunk', audio: base64 }));
            };
            reader.readAsDataURL(e.data);
          }
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[VoiceRecorder] Recording stopped, total chunks:', chunksRef.current.length);
        
        // Request final audio from server if available
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'stop' }));
          
          // Wait for server response
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => resolve(), 3000);
            
            wsRef.current!.onmessage = async (event) => {
              const data = JSON.parse(event.data);
              if (data.type === 'completed' && data.audio) {
                clearTimeout(timeout);
                console.log('[VoiceRecorder] Using server-streamed audio');
                
                // Decode base64 from server
                const binaryString = atob(data.audio);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                const serverBlob = new Blob([bytes], { type: 'audio/webm' });
                await processAudio(serverBlob);
                resolve();
              }
            };
          });
        } else {
          // Fallback to local recording
          console.log('[VoiceRecorder] Using local recording');
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          await processAudio(audioBlob);
        }
        
        stream.getTracks().forEach(track => track.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        localStorage.removeItem('recording_session');
      };

      // Start timer - use wall clock to avoid background throttling drift
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const start = startTimeRef.current || Date.now();
        const elapsed = Math.floor((Date.now() - start) / 1000);
        if (elapsed >= maxRecordingTime) {
          console.log('[VoiceRecorder] Max recording time reached');
          stopRecording();
          toast.info("30-minute recording limit reached");
          return;
        }
        setRecordingTime(elapsed);
        
        // Persist session state
        if (sessionIdRef.current) {
          localStorage.setItem('recording_session', JSON.stringify({
            sessionId: sessionIdRef.current,
            duration: elapsed,
            timestamp: Date.now()
          }));
        }
      }, 1000);

      mediaRecorder.start(1000); // emit data every 1s to minimize loss
      setIsRecording(true);
      console.log('[VoiceRecorder] MediaRecorder started');
      toast.success("Recording started (max 30 minutes)");
    } catch (error) {
      console.error("[VoiceRecorder] Error starting recording:", error);
      toast.error("Failed to start recording");
    }
  };

  const stopRecording = () => {
    console.log('[VoiceRecorder] Stop recording called');
    if (mediaRecorderRef.current && isRecording) {
      console.log('[VoiceRecorder] Stopping MediaRecorder...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      
      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      // Release wake lock
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('[VoiceRecorder] Wake lock released');
      }
    }
  };

  // Handle app state changes for native app
  useEffect(() => {
    let appStateListener: any;

    const setupAppStateListener = async () => {
      try {
        appStateListener = await CapacitorApp.addListener('appStateChange', (state) => {
          console.log('[VoiceRecorder] App state changed:', state.isActive);
          // Keep recording even when app goes to background in native mode
        });
        console.log('[VoiceRecorder] App state listener registered');
      } catch (error) {
        console.log('[VoiceRecorder] Not running in Capacitor, skipping app state listener');
      }
    };

    setupAppStateListener();

    return () => {
      if (appStateListener) {
        appStateListener.remove();
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    console.log('Audio blob size:', audioBlob.size, 'bytes');
    console.log('Audio blob type:', audioBlob.type);
    
    try {
      // Convert blob to base64 in chunks to handle large files
      const arrayBuffer = await audioBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      console.log('Audio buffer size:', bytes.length, 'bytes');
      
      // Convert to base64 in chunks
      let base64Audio = '';
      const chunkSize = 0x8000; // 32KB chunks
      
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        base64Audio += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      base64Audio = btoa(base64Audio);
      console.log('Base64 audio length:', base64Audio.length);

      toast.info("Transcribing audio...");
      
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio: base64Audio }
      });

      if (error) {
        console.error('Transcription error:', error);
        throw error;
      }

      console.log('Transcription result:', data);

      if (data?.text) {
        console.log('Transcribed text length:', data.text.length);
        onTranscriptComplete(data.text);
      } else {
        throw new Error('No transcription returned');
      }
    } catch (error) {
      console.error("Error processing audio:", error);
      toast.error("Failed to transcribe audio");
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Button
          size="lg"
          variant={isRecording ? "destructive" : "default"}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={`rounded-full h-16 w-16 transition-all ${
            isRecording ? "animate-pulse shadow-glow" : "shadow-soft"
          }`}
        >
          {isRecording ? <Square className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>
        {isRecording && (
          <div className="absolute inset-0 rounded-full border-4 border-primary animate-ping opacity-50 pointer-events-none" />
        )}
      </div>
      
      {/* Status indicators */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {isRecording 
            ? `Recording: ${formatTime(recordingTime)} / 30:00` 
            : isProcessing 
            ? "Processing..." 
            : "Click to record (max 30 min)"}
        </p>
        
        {isRecording && (
          <div className="flex items-center gap-2 text-xs">
            {streamingStatus === 'connected' && (
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <Wifi className="h-3 w-3" />
                <span>Streaming ({chunksStreamed} chunks sent)</span>
              </div>
            )}
            {streamingStatus === 'disconnected' && (
              <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                <WifiOff className="h-3 w-3" />
                <span>Recording locally only</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceRecorder;