import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { RealtimeChat } from '@/utils/RealtimeAudio';
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface VoiceInterfaceProps {
  onSpeakingChange: (speaking: boolean) => void;
}

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ onSpeakingChange }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef<RealtimeChat | null>(null);

  const handleMessage = (event: any) => {
    console.log('[VoiceInterface] Received message:', event.type);
    
    if (event.type === 'response.audio.delta') {
      setIsSpeaking(true);
      onSpeakingChange(true);
    } else if (event.type === 'response.audio.done') {
      setIsSpeaking(false);
      onSpeakingChange(false);
    } else if (event.type === 'input_audio_buffer.speech_started') {
      console.log('[VoiceInterface] User started speaking');
    } else if (event.type === 'input_audio_buffer.speech_stopped') {
      console.log('[VoiceInterface] User stopped speaking');
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
            {isSpeaking ? (
              <>
                <Volume2 className="h-5 w-5 text-primary animate-pulse" />
                <span className="text-sm font-medium">AI is speaking...</span>
              </>
            ) : (
              <>
                <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">Listening...</span>
              </>
            )}
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
