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
    
    if (event.type === 'mode_change') {
      // Handle explicit mode changes from AI tool calls
      const newMode = event.mode === 'passive' ? 'passive' : 'active';
      console.log('[VoiceInterface] AI switched to mode:', newMode);
      setAiMode(newMode);
      if (newMode === 'passive') {
        setIsSpeaking(false);
        onSpeakingChange(false);
      }
    } else if (event.type === 'response.audio.delta') {
      setIsSpeaking(true);
      setAiMode('speaking');
      onSpeakingChange(true);
    } else if (event.type === 'response.audio.done') {
      setIsSpeaking(false);
      // Only return to active if not in passive mode
      if (aiMode !== 'passive') {
        setAiMode('active');
      }
      onSpeakingChange(false);
    } else if (event.type === 'input_audio_buffer.speech_started') {
      console.log('[VoiceInterface] User started speaking');
    } else if (event.type === 'input_audio_buffer.speech_stopped') {
      console.log('[VoiceInterface] User stopped speaking');
    } else if (event.type === 'response.created') {
      if (aiMode !== 'passive') {
        setAiMode('thinking');
      }
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
    switch(aiMode) {
      case 'passive':
        return {
          icon: <Ear className="h-6 w-6" />,
          text: 'Recording...',
          color: 'text-orange-400',
          bgColor: 'bg-orange-500/10'
        };
      case 'thinking':
        return {
          icon: <Loader2 className="h-6 w-6 animate-spin" />,
          text: 'Processing...',
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10'
        };
      case 'speaking':
        return {
          icon: <Volume2 className="h-6 w-6 animate-pulse" />,
          text: 'JARVIS Speaking',
          color: 'text-primary',
          bgColor: 'bg-primary/10'
        };
      default:
        return {
          icon: <Mic className="h-6 w-6 animate-pulse" />,
          text: 'JARVIS Active',
          color: 'text-green-400',
          bgColor: 'bg-green-500/10'
        };
    }
  };

  const modeDisplay = getModeDisplay();

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-50">
      {!isConnected ? (
        <Button 
          onClick={startConversation}
          disabled={isLoading}
          className="rounded-full w-20 h-20 bg-primary hover:bg-primary/90 text-white shadow-lg hover:shadow-xl transition-all"
        >
          {isLoading ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <Mic className="h-8 w-8" />
          )}
        </Button>
      ) : (
        <>
          <div className={`flex items-center gap-4 px-8 py-4 rounded-full backdrop-blur-sm border-2 shadow-xl transition-all ${getModeDisplay().bgColor} ${getModeDisplay().color} border-current/20`}>
            {getModeDisplay().icon}
            <span className="font-semibold text-base">{getModeDisplay().text}</span>
          </div>
          <Button 
            onClick={endConversation}
            variant="secondary"
            className="rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-all"
          >
            <MicOff className="h-6 w-6" />
          </Button>
        </>
      )}
    </div>
  );
};

export default VoiceInterface;
