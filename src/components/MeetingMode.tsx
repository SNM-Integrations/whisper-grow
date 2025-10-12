import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Mic, MicOff, Square, Play, Clock, Users, CheckCircle, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChat } from '@/utils/RealtimeAudio';

interface MeetingModeProps {
  onClose: () => void;
}

interface ActionItem {
  id: string;
  title: string;
  priority: string;
  created_at: string;
}

interface Decision {
  id: string;
  content: string;
  created_at: string;
}

const MeetingMode: React.FC<MeetingModeProps> = ({ onClose }) => {
  const { toast } = useToast();
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [meetingTitle, setMeetingTitle] = useState('');
  const chatRef = useRef<RealtimeChat | null>(null);
  const durationInterval = useRef<number | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isRecording && !isPaused) {
      durationInterval.current = window.setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } else if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, [isRecording, isPaused]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  useEffect(() => {
    if (!meetingId) return;

    // Subscribe to real-time updates for tasks and notes created during the meeting
    const tasksChannel = supabase
      .channel('meeting-tasks')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks',
          filter: `meeting_id=eq.${meetingId}`
        },
        (payload) => {
          const newTask = payload.new as ActionItem;
          setActionItems(prev => [...prev, newTask]);
          toast({
            title: "Action Item Added",
            description: newTask.title,
          });
        }
      )
      .subscribe();

    const notesChannel = supabase
      .channel('meeting-notes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notes',
          filter: `meeting_id=eq.${meetingId}`
        },
        (payload) => {
          const newNote = payload.new as Decision;
          setDecisions(prev => [...prev, newNote]);
          toast({
            title: "Decision Captured",
            description: newNote.content.substring(0, 50) + '...',
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(notesChannel);
    };
  }, [meetingId, toast]);

  const handleMessage = (event: any) => {
    console.log('Meeting event:', event);

    if (event.type === 'response.audio_transcript.delta') {
      setTranscript(prev => {
        const newTranscript = [...prev];
        if (newTranscript.length === 0 || event.delta.startsWith(' ')) {
          newTranscript.push(event.delta.trim());
        } else {
          newTranscript[newTranscript.length - 1] += event.delta;
        }
        return newTranscript;
      });
    }

    if (event.type === 'response.function_call_arguments.done') {
      console.log('Function call:', event.name, event.arguments);
    }
  };

  const startMeeting = async () => {
    if (!meetingTitle.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a meeting title",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create meeting record
      const { data: meeting, error } = await supabase
        .from('meetings')
        .insert({
          title: meetingTitle,
          user_id: user.id,
          status: 'in_progress'
        })
        .select()
        .single();

      if (error) throw error;

      setMeetingId(meeting.id);

      // Start WebRTC connection with meeting agent
      chatRef.current = new RealtimeChat(handleMessage, 'meeting', meeting.id);
      await chatRef.current.init();

      setIsRecording(true);
      toast({
        title: "Meeting Started",
        description: "AI assistant is now listening and capturing items",
      });
    } catch (error) {
      console.error('Error starting meeting:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to start meeting',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const endMeeting = async () => {
    setIsLoading(true);
    try {
      chatRef.current?.disconnect();
      setIsRecording(false);

      if (meetingId) {
        // Update meeting with transcript and end time
        await supabase
          .from('meetings')
          .update({
            end_time: new Date().toISOString(),
            transcript: transcript.join('\n'),
            status: 'completed'
          })
          .eq('id', meetingId);

        // Generate summary
        toast({
          title: "Generating Summary",
          description: "Creating meeting summary...",
        });

        await supabase.functions.invoke('generate-meeting-summary', {
          body: { meetingId }
        });

        toast({
          title: "Meeting Ended",
          description: `Captured ${actionItems.length} action items and ${decisions.length} decisions`,
        });
      }

      onClose();
    } catch (error) {
      console.error('Error ending meeting:', error);
      toast({
        title: "Error",
        description: 'Failed to end meeting properly',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePause = () => {
    // Pause functionality can be added later if needed
    setIsPaused(!isPaused);
    toast({
      title: isPaused ? "Recording Resumed" : "Recording Paused",
      description: isPaused ? "Meeting recording resumed" : "Meeting recording paused"
    });
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isRecording) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="p-8 max-w-md w-full">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <Mic className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Start a Meeting</h2>
              <p className="text-muted-foreground">
                AI will capture action items and key decisions automatically
              </p>
            </div>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Enter meeting title..."
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                className="w-full px-4 py-2 border rounded-md"
                onKeyDown={(e) => e.key === 'Enter' && startMeeting()}
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={startMeeting}
                disabled={isLoading}
                className="flex-1"
                size="lg"
              >
                {isLoading ? 'Starting...' : 'Start Meeting'}
              </Button>
              <Button
                onClick={onClose}
                variant="outline"
                size="lg"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
            <div>
              <h2 className="font-semibold">{meetingTitle}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{formatDuration(duration)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={togglePause}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              onClick={endMeeting}
              variant="destructive"
              size="sm"
              disabled={isLoading}
            >
              <Square className="w-4 h-4 mr-2" />
              End Meeting
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
        {/* Live Transcript */}
        <Card className="col-span-2 p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5" />
            <h3 className="font-semibold">Live Transcript</h3>
            {!isPaused && <Badge variant="outline" className="ml-auto">Recording</Badge>}
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-2 pr-4">
              {transcript.map((text, idx) => (
                <p key={idx} className="text-sm">
                  {text}
                </p>
              ))}
              {transcript.length === 0 && (
                <p className="text-sm text-muted-foreground italic">
                  Listening... Start speaking to see the transcript.
                </p>
              )}
              <div ref={transcriptEndRef} />
            </div>
          </ScrollArea>
        </Card>

        {/* Action Items & Decisions */}
        <div className="flex flex-col gap-4">
          {/* Action Items */}
          <Card className="p-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5" />
              <h3 className="font-semibold">Action Items</h3>
              <Badge variant="secondary" className="ml-auto">{actionItems.length}</Badge>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-4">
                {actionItems.map((item) => (
                  <div key={item.id} className="p-2 border rounded-md">
                    <p className="text-sm font-medium">{item.title}</p>
                    <Badge variant="outline" className="mt-1">
                      {item.priority}
                    </Badge>
                  </div>
                ))}
                {actionItems.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">
                    No action items yet
                  </p>
                )}
              </div>
            </ScrollArea>
          </Card>

          {/* Decisions */}
          <Card className="p-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5" />
              <h3 className="font-semibold">Key Decisions</h3>
              <Badge variant="secondary" className="ml-auto">{decisions.length}</Badge>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-4">
                {decisions.map((decision) => (
                  <div key={decision.id} className="p-2 border rounded-md">
                    <p className="text-sm">{decision.content.substring(0, 100)}...</p>
                  </div>
                ))}
                {decisions.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">
                    No decisions captured yet
                  </p>
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MeetingMode;