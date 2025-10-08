import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AudioRecorder, AudioQueue, encodeAudioForAPI } from "@/utils/audioUtils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ConversationalInterfaceProps {
  onNoteCreated?: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const ConversationalInterface = ({ onNoteCreated }: ConversationalInterfaceProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioQueue | null>(null);

  useEffect(() => {
    // Initialize audio context
    audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    audioQueueRef.current = new AudioQueue(audioContextRef.current);

    return () => {
      disconnect();
      audioContextRef.current?.close();
    };
  }, []);

  const connect = async () => {
    try {
      // Get auth token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        toast.error("Please sign in to use the AI assistant");
        return;
      }

      const token = session.access_token;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'pccvvqmrwbcdjgkyteqn';
      const wsUrl = `wss://${projectId}.supabase.co/functions/v1/realtime-conversation?token=${token}`;

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = async () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        toast.success("AI Assistant connected");

        // Start audio recording
        recorderRef.current = new AudioRecorder((audioData) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const base64Audio = encodeAudioForAPI(audioData);
            wsRef.current.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: base64Audio
            }));
          }
        });

        await recorderRef.current.start();
        setIsRecording(true);
      };

      wsRef.current.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log("Received:", data.type);

        // Handle different message types
        if (data.type === 'error') {
          toast.error(data.message);
          disconnect();
        } else if (data.type === 'response.audio.delta') {
          // Play audio response
          setIsSpeaking(true);
          const binaryString = atob(data.delta);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          await audioQueueRef.current?.addToQueue(bytes);
        } else if (data.type === 'response.audio.done') {
          setIsSpeaking(false);
        } else if (data.type === 'conversation.item.input_audio_transcription.completed') {
          // User speech transcribed
          const transcript = data.transcript;
          setMessages(prev => [...prev, {
            role: 'user',
            content: transcript,
            timestamp: new Date()
          }]);
          setCurrentTranscript("");
        } else if (data.type === 'response.audio_transcript.delta') {
          // AI response transcript (accumulate)
          setCurrentTranscript(prev => prev + data.delta);
        } else if (data.type === 'response.audio_transcript.done') {
          // AI response complete
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: currentTranscript,
            timestamp: new Date()
          }]);
          setCurrentTranscript("");
        } else if (data.type === 'response.done') {
          // Check if a note was created
          if (data.response?.output?.some((o: any) => 
            o.type === 'function_call' && o.name === 'save_thought')) {
            onNoteCreated?.();
          }
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        toast.error("Connection error");
      };

      wsRef.current.onclose = () => {
        console.log("WebSocket closed");
        setIsConnected(false);
        setIsRecording(false);
        setIsSpeaking(false);
        recorderRef.current?.stop();
        toast.info("AI Assistant disconnected");
      };

    } catch (error) {
      console.error("Error connecting:", error);
      toast.error("Failed to connect to AI Assistant");
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    audioQueueRef.current?.clear();
    setIsConnected(false);
    setIsRecording(false);
    setIsSpeaking(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      // Pause recording (commit audio buffer)
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'input_audio_buffer.commit'
        }));
      }
      setIsRecording(false);
    } else {
      // Resume recording
      setIsRecording(true);
    }
  };

  return (
    <div className="flex flex-col h-[600px] gap-4">
      {/* Conversation History */}
      <ScrollArea className="flex-1 rounded-lg border bg-background/50 p-4">
        {messages.length === 0 && !isConnected && (
          <div className="text-center text-muted-foreground py-12">
            <p className="text-lg mb-2">Start a conversation with your AI assistant</p>
            <p className="text-sm">
              Ask questions, capture thoughts, research topics, or query your knowledge base
            </p>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`rounded-lg px-4 py-2 max-w-[80%] ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              <p className="text-sm">{msg.content}</p>
              <p className="text-xs opacity-70 mt-1">
                {msg.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {/* Current transcript being spoken */}
        {currentTranscript && (
          <div className="mb-4 flex justify-start">
            <div className="rounded-lg px-4 py-2 max-w-[80%] bg-muted animate-pulse">
              <p className="text-sm">{currentTranscript}</p>
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Controls */}
      <div className="flex flex-col items-center gap-4 p-4 border-t">
        <div className="flex items-center gap-4">
          {!isConnected ? (
            <Button
              size="lg"
              onClick={connect}
              className="rounded-full h-16 w-16"
            >
              <Mic className="h-6 w-6" />
            </Button>
          ) : (
            <>
              <Button
                size="lg"
                variant={isRecording ? "default" : "secondary"}
                onClick={toggleRecording}
                className="rounded-full h-16 w-16"
              >
                {isRecording ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
              </Button>
              
              <Button
                size="lg"
                variant="outline"
                onClick={disconnect}
                className="rounded-full h-16 w-16"
              >
                <MicOff className="h-6 w-6" />
              </Button>
            </>
          )}
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {isConnected && (
            <>
              {isRecording && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <span>Listening...</span>
                </div>
              )}
              {isSpeaking && (
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 animate-pulse" />
                  <span>Speaking...</span>
                </div>
              )}
              {!isRecording && !isSpeaking && (
                <span>Connected • Tap microphone to speak</span>
              )}
            </>
          )}
          {!isConnected && (
            <span>Click the microphone to start</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationalInterface;
