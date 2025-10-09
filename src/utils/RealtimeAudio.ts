import { supabase } from "@/integrations/supabase/client";

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private onAudioData: (audioData: Float32Array) => void) {}

  async start() {
    try {
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
  }
}

export class RealtimeChat {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private audioEl: HTMLAudioElement;
  private recorder: AudioRecorder | null = null;

  constructor(private onMessage: (message: any) => void) {
    this.audioEl = document.createElement("audio");
    this.audioEl.autoplay = true;
  }

  async init() {
    try {
      console.log('[RealtimeChat] Initializing WebRTC connection...');
      
      // Get ephemeral token from our edge function
      const { data, error } = await supabase.functions.invoke("create-realtime-session");
      
      if (error || !data?.client_secret?.value) {
        throw new Error(`Failed to get ephemeral token: ${error?.message || 'No token returned'}`);
      }

      const EPHEMERAL_KEY = data.client_secret.value;
      console.log('[RealtimeChat] Ephemeral token received');

      // Create peer connection
      this.pc = new RTCPeerConnection();

      // Set up remote audio
      this.pc.ontrack = e => {
        console.log('[RealtimeChat] Remote audio track received');
        this.audioEl.srcObject = e.streams[0];
      };

      // Add local audio track
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      console.log('[RealtimeChat] Local description set');

      // Connect to OpenAI's Realtime API
      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp"
        },
      });

      if (!sdpResponse.ok) {
        throw new Error(`OpenAI SDP exchange failed: ${await sdpResponse.text()}`);
      }

      const answer = {
        type: "answer" as RTCSdpType,
        sdp: await sdpResponse.text(),
      };
      
      await this.pc.setRemoteDescription(answer);
      console.log('[RealtimeChat] WebRTC connection established');

    } catch (error) {
      console.error('[RealtimeChat] Initialization failed:', error);
      throw error;
    }
  }

  private async handleToolCall(toolName: string, args: any) {
    console.log('[RealtimeChat] Handling tool call:', toolName);

    switch (toolName) {
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
  }
}
