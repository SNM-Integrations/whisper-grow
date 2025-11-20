import { supabase } from "@/integrations/supabase/client";

class CircularAudioBuffer {
  private buffer: Float32Array;
  private writePos = 0;
  private readonly BUFFER_DURATION = 30; // seconds
  private readonly SAMPLE_RATE = 24000;
  private size: number;

  constructor() {
    this.size = this.BUFFER_DURATION * this.SAMPLE_RATE;
    this.buffer = new Float32Array(this.size);
  }

  append(chunk: Float32Array) {
    for (let i = 0; i < chunk.length; i++) {
      this.buffer[this.writePos] = chunk[i];
      this.writePos = (this.writePos + 1) % this.size;
    }
  }

  getBuffer(): Float32Array {
    // Return the buffer in chronological order
    const result = new Float32Array(this.size);
    for (let i = 0; i < this.size; i++) {
      result[i] = this.buffer[(this.writePos + i) % this.size];
    }
    return result;
  }

  clear() {
    this.buffer.fill(0);
    this.writePos = 0;
  }
}

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private wakeLock: any = null;

  constructor(private onAudioData: (audioData: Float32Array) => void) {}

  async start() {
    try {
      // Request wake lock to keep recording active with screen off
      if ('wakeLock' in navigator) {
        try {
          this.wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log('Wake lock acquired - recording will stay active');
        } catch (err) {
          console.warn('Wake lock failed:', err);
        }
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      this.audioContext = new AudioContext({
        sampleRate: 24000,
      });
      
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        this.onAudioData(new Float32Array(inputData));
      };
      
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  stop() {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    // Release wake lock
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
      console.log('Wake lock released');
    }
  }
}

export class RealtimeChat {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private audioEl: HTMLAudioElement;
  private recorder: AudioRecorder | null = null;
  private agentType: string;
  private meetingId?: string;
  private wakeLock: any = null;
  private audioBuffer: CircularAudioBuffer;

  constructor(
    private onMessage: (message: any) => void, 
    agentType: string = 'conversation',
    meetingId?: string
  ) {
    this.audioEl = document.createElement("audio");
    this.audioEl.autoplay = true;
    this.agentType = agentType;
    this.meetingId = meetingId;
    this.audioBuffer = new CircularAudioBuffer();
  }

  async init() {
    try {
      console.log('[RealtimeChat] Initializing WebRTC connection...');
      
      // Get ephemeral token from our edge function
      const { data, error } = await supabase.functions.invoke("create-realtime-session", {
        body: { agentType: this.agentType, meetingId: this.meetingId ?? null }
      });
      
      if (error) {
        console.error('[RealtimeChat] Token fetch error:', error);
        throw new Error(`Failed to get ephemeral token: ${error.message}`);
      }
      
      if (!data?.client_secret?.value) {
        console.error('[RealtimeChat] Invalid token response:', data);
        throw new Error('Failed to get ephemeral token - invalid response');
      }

      const EPHEMERAL_KEY = data.client_secret.value;
      console.log('[RealtimeChat] Ephemeral token received');

      // Create peer connection
      console.log('[RealtimeChat] Creating RTCPeerConnection...');
      this.pc = new RTCPeerConnection();

      // Set up remote audio with autoplay handling
      this.pc.ontrack = async (e) => {
        console.log('[RealtimeChat] Remote audio track received');
        this.audioEl.srcObject = e.streams[0];
        
        // Handle autoplay restrictions
        try {
          await this.audioEl.play();
          console.log('[RealtimeChat] Audio playback started');
        } catch (playError) {
          console.warn('[RealtimeChat] Autoplay blocked, will retry on user interaction:', playError);
          // Retry on next user interaction
          const retryPlay = async () => {
            try {
              await this.audioEl.play();
              console.log('[RealtimeChat] Audio playback started after retry');
              document.removeEventListener('click', retryPlay);
              document.removeEventListener('touchstart', retryPlay);
            } catch (e) {
              console.error('[RealtimeChat] Audio playback failed:', e);
            }
          };
          document.addEventListener('click', retryPlay, { once: true });
          document.addEventListener('touchstart', retryPlay, { once: true });
        }
      };

      // Add local audio track
      console.log('[RealtimeChat] Requesting microphone access...');
      
      // Request wake lock to keep recording active with screen off
      if ('wakeLock' in navigator) {
        try {
          this.wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log('[RealtimeChat] Wake lock acquired - recording will stay active');
        } catch (err) {
          console.warn('[RealtimeChat] Wake lock failed:', err);
        }
      }

      const ms = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      console.log('[RealtimeChat] Microphone access granted');
      this.pc.addTrack(ms.getTracks()[0]);
      console.log('[RealtimeChat] Local audio track added');

      // Set up data channel for events
      this.dc = this.pc.createDataChannel("oai-events");
      
      this.dc.addEventListener("open", () => {
        console.log('[RealtimeChat] Data channel opened');
      });
      
      this.dc.addEventListener("message", async (e) => {
        const event = JSON.parse(e.data);
        console.log('[RealtimeChat] Event received:', event.type);
        this.onMessage(event);

        // Handle function calls
        if (event.type === 'response.function_call_arguments.done') {
          const { name, call_id, arguments: argsStr } = event;
          const args = JSON.parse(argsStr);
          console.log('[RealtimeChat] Function call:', name, args);

          try {
            const result = await this.handleToolCall(name, args);
            
            // Send result back to OpenAI
            if (this.dc?.readyState === 'open') {
              this.dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id,
                  output: JSON.stringify(result)
                }
              }));
              this.dc.send(JSON.stringify({ type: 'response.create' }));
            }
          } catch (error) {
            console.error('[RealtimeChat] Tool call failed:', error);
            if (this.dc?.readyState === 'open') {
              this.dc.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id,
                  output: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })
                }
              }));
              this.dc.send(JSON.stringify({ type: 'response.create' }));
            }
          }
        }
      });

      // Create and set local description
      console.log('[RealtimeChat] Creating WebRTC offer...');
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      console.log('[RealtimeChat] Local description set');

      // Connect to OpenAI's Realtime API
      console.log('[RealtimeChat] Connecting to OpenAI Realtime API...');
      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-realtime";
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp"
        },
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        console.error('[RealtimeChat] OpenAI SDP negotiation failed:', sdpResponse.status, errorText);
        throw new Error(`OpenAI connection failed: ${sdpResponse.status} ${errorText}`);
      }

      const answer = {
        type: "answer" as RTCSdpType,
        sdp: await sdpResponse.text(),
      };
      
      console.log('[RealtimeChat] Setting remote description...');
      await this.pc.setRemoteDescription(answer);
      console.log('[RealtimeChat] WebRTC connection established successfully');

    } catch (error) {
      console.error('[RealtimeChat] Initialization failed:', error);
      this.disconnect(); // Clean up on error
      throw error;
    }
  }

  private async handleToolCall(toolName: string, args: any) {
    console.log('[RealtimeChat] Handling tool call:', toolName);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    switch (toolName) {
      case 'set_listening_mode': {
        // Handle mode switching
        const mode = args.mode as 'active' | 'passive';
        console.log(`[RealtimeChat] Switching to ${mode} mode`);
        
        // Emit mode change event back to UI
        this.onMessage({
          type: 'mode_change',
          mode: mode
        });
        
        return { success: true, mode: mode };
      }

      case 'save_action_item': {
        const { title, description, priority, owner } = args;
        const taskDescription = [
          description,
          owner ? `Owner: ${owner}` : null
        ].filter(Boolean).join('\n');

        const { data, error } = await supabase
          .from('tasks')
          .insert({
            title,
            description: taskDescription || null,
            priority: priority || 'medium',
            user_id: user.id,
            meeting_id: this.meetingId || null,
            completed: false
          })
          .select()
          .single();

        if (error) throw error;
        return { success: true, task: data, message: `Action item created: ${title}` };
      }

      case 'save_decision': {
        const { decision, context } = args;
        const content = context ? `**Decision:** ${decision}\n\n**Context:** ${context}` : decision;

        const { data, error } = await supabase
          .from('notes')
          .insert({
            content,
            user_id: user.id,
            meeting_id: this.meetingId || null,
            note_type: 'original'
          })
          .select()
          .single();

        if (error) throw error;

        // Generate embedding
        await supabase.functions.invoke('generate-embeddings', {
          body: { noteId: data.id, content }
        });

        return { success: true, note: data, message: 'Decision captured' };
      }

      case 'update_meeting_participants': {
        if (!this.meetingId) {
          return { success: false, message: 'No active meeting' };
        }

        const { participants } = args;
        const { error } = await supabase
          .from('meetings')
          .update({ participants })
          .eq('id', this.meetingId);

        if (error) throw error;
        return { success: true, message: `Updated participants: ${participants.join(', ')}` };
      }

      case 'save_thought': {
        const { data, error } = await supabase.functions.invoke('process-smart-input', {
          body: { text: args.text }
        });
        if (error) throw error;
        return data;
      }

      case 'query_knowledge': {
        // Generate embeddings
        const { data: embData, error: embError } = await supabase.functions.invoke('generate-embeddings', {
          body: { text: args.query }
        });
        if (embError) throw embError;

        // Search notes
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: notes, error: notesError } = await supabase.rpc('match_notes', {
          query_embedding: embData.embedding,
          match_threshold: 0.7,
          match_count: 5,
          user_id_param: user.id
        });
        if (notesError) throw notesError;

        return { notes };
      }

      case 'get_tasks': {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        let query = supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (typeof args.completed === 'boolean') {
          query = query.eq('completed', args.completed);
        }

        if (args.limit) {
          query = query.limit(args.limit);
        } else {
          query = query.limit(10);
        }

        const { data, error } = await query;
        if (error) throw error;
        return { tasks: data };
      }

      case 'get_calendar_events': {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('user_id', user.id)
          .gte('start_time', args.start_date)
          .lte('end_time', args.end_date)
          .order('start_time', { ascending: true });

        if (error) throw error;
        return { events: data };
      }

      case 'create_calendar_event': {
        const { title, start_time, end_time, description, location } = args;
        
        // Default end time to 1 hour after start if not provided
        const endTime = end_time || new Date(new Date(start_time).getTime() + 3600000).toISOString();

        const { data, error } = await supabase
          .from('calendar_events')
          .insert({
            title,
            start_time,
            end_time: endTime,
            description: description || null,
            location: location || null,
            user_id: user.id
          })
          .select()
          .single();

        if (error) throw error;
        return { success: true, event: data, message: `Added to calendar: ${title}` };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  async sendMessage(text: string) {
    if (!this.dc || this.dc.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    const event = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text
          }
        ]
      }
    };

    this.dc.send(JSON.stringify(event));
    this.dc.send(JSON.stringify({type: 'response.create'}));
  }

  disconnect() {
    this.recorder?.stop();
    this.dc?.close();
    this.pc?.close();
    this.audioEl.srcObject = null;
    
    // Release wake lock
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
      console.log('[RealtimeChat] Wake lock released');
    }
  }
}
