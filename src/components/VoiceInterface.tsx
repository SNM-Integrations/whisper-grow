import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { RealtimeChat } from '@/utils/RealtimeAudio';
import { Mic, MicOff, Volume2, Loader2, Ear } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface VoiceInterfaceProps {
  onSpeakingChange: (speaking: boolean) => void;
}

type AIMode = 'active' | 'passive' | 'thinking' | 'speaking';

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ onSpeakingChange }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [aiMode, setAiMode] = useState<AIMode>('active');
  const chatRef = useRef<RealtimeChat | null>(null);

  const handleMessage = (event: any) => {
    console.log('[VoiceInterface] Received message:', event.type);
    
    if (event.type === 'response.audio.delta') {
      setIsSpeaking(true);
      setAiMode('speaking');
      onSpeakingChange(true);
    } else if (event.type === 'response.audio.done') {
      setIsSpeaking(false);
      setAiMode('active');
      onSpeakingChange(false);
    } else if (event.type === 'input_audio_buffer.speech_started') {
      console.log('[VoiceInterface] User started speaking');
    } else if (event.type === 'input_audio_buffer.speech_stopped') {
      console.log('[VoiceInterface] User stopped speaking');
    } else if (event.type === 'response.audio_transcript.delta') {
      // Detect mode from AI transcript
      const transcript = event.delta?.toLowerCase() || '';
      if (transcript.includes("i'm listening") || transcript.includes("go ahead") || transcript.includes("listening")) {
        setAiMode('passive');
      }
    } else if (event.type === 'response.created') {
      setAiMode('thinking');
    }
  };

  const startConversation = async () => {
    setIsLoading(true);
    try {
      console.log('[VoiceInterface] Starting conversation...');
      
      // Check authentication first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not Authenticated", {
          description: "Please sign in to use the AI assistant",
        });
        setIsLoading(false);
        return;
      }

      // Check microphone permissions
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Release immediately after check
      } catch (micError) {
        console.error('[VoiceInterface] Microphone access denied:', micError);
        toast.error("Microphone Access Denied", {
          description: "Please allow microphone access to use voice features",
        });
        setIsLoading(false);
        return;
      }

      chatRef.current = new RealtimeChat(handleMessage);
      await chatRef.current.init();
      setIsConnected(true);
      
      toast.success("AI Assistant Connected", {
        description: "Start speaking to interact with your AI assistant",
      });
    } catch (error) {
      console.error('[VoiceInterface] Error starting conversation:', error);
      
      // Provide specific error messages
      if (error instanceof Error) {
        if (error.message.includes('ephemeral token')) {
          toast.error("Connection Failed", {
            description: "Unable to authenticate with AI service. Please try again.",
          });
        } else if (error.message.includes('WebRTC')) {
          toast.error("Connection Failed", {
            description: "Failed to establish audio connection. Please check your network.",
          });
        } else {
          toast.error("Connection Failed", {
            description: error.message,
          });
        }
      } else {
        toast.error("Connection Failed", {
          description: "An unexpected error occurred. Please try again.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const endConversation = () => {
    console.log('[VoiceInterface] Ending conversation...');
    chatRef.current?.disconnect();
    setIsConnected(false);
    setIsSpeaking(false);
    onSpeakingChange(false);
    toast.info("AI Assistant Disconnected");
  };

  useEffect(() => {
    return () => {
      chatRef.current?.disconnect();
    };
  }, []);

  const getModeDisplay = () => {
    switch (aiMode) {
      case 'passive':
        return {
          icon: <Ear className="h-5 w-5 text-muted-foreground" />,
          text: "Recording your thoughts...",
          color: "text-muted-foreground"
        };
      case 'thinking':
        return {
          icon: <Loader2 className="h-5 w-5 text-primary animate-spin" />,
          text: "Analyzing context...",
          color: "text-primary"
        };
      case 'speaking':
        return {
          icon: <Volume2 className="h-5 w-5 text-primary animate-pulse" />,
          text: "AI is speaking...",
          color: "text-primary"
        };
      default: // active
        return {
          icon: <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />,
          text: "AI Assistant Active",
          color: "text-foreground"
        };
    }
  };

  const modeDisplay = getModeDisplay();

  return (
    <div className="fixed bottom-8 right-8 flex flex-col items-center gap-4 z-50">
      {!isConnected ? (
        <Button 
          onClick={startConversation}
          disabled={isLoading}
          size="lg"
          className="rounded-full h-16 w-16 shadow-lg"
        >
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </Button>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 bg-background/95 backdrop-blur-sm border rounded-full px-4 py-2 shadow-lg">
            {modeDisplay.icon}
            <span className={`text-sm font-medium ${modeDisplay.color}`}>
              {modeDisplay.text}
            </span>
          </div>
          <Button 
            onClick={endConversation}
            variant="destructive"
            size="lg"
            className="rounded-full h-16 w-16 shadow-lg"
          >
            <MicOff className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default VoiceInterface;
