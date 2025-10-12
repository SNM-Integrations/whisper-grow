import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface VoiceRecorderProps {
  onTranscriptComplete: (text: string) => void;
}

const VoiceRecorder = ({ onTranscriptComplete }: VoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<any>(null);
  const startTimeRef = useRef<number | null>(null);
  const maxRecordingTime = 30 * 60; // 30 minutes in seconds

  const startRecording = async () => {
    try {
      // Request wake lock to keep recording active with screen off
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log('Wake lock acquired - recording will stay active');
        } catch (err) {
          console.warn('Wake lock failed:', err);
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setRecordingTime(0);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        if (timerRef.current) clearInterval(timerRef.current);
      };

      // Start timer - use wall clock to avoid background throttling drift
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const start = startTimeRef.current || Date.now();
        const elapsed = Math.floor((Date.now() - start) / 1000);
        if (elapsed >= maxRecordingTime) {
          stopRecording();
          toast.info("30-minute recording limit reached");
          return;
        }
        setRecordingTime(elapsed);
      }, 1000);

      mediaRecorder.start(1000); // emit data every 1s to minimize loss
      setIsRecording(true);
      toast.success("Recording started (max 30 minutes)");
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Failed to start recording");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      
      // Release wake lock
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('Wake lock released');
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result?.toString().split(',')[1];
        
        if (!base64Audio) {
          throw new Error('Failed to convert audio');
        }

        const { data, error } = await supabase.functions.invoke('transcribe-audio', {
          body: { audio: base64Audio }
        });

        if (error) throw error;

        if (data?.text) {
          onTranscriptComplete(data.text);
          toast.success("Audio transcribed successfully");
        }
      };
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
      <p className="text-sm text-muted-foreground">
        {isRecording 
          ? `Recording: ${formatTime(recordingTime)} / 30:00` 
          : isProcessing 
          ? "Processing..." 
          : "Click to record (max 30 min)"}
      </p>
    </div>
  );
};

export default VoiceRecorder;