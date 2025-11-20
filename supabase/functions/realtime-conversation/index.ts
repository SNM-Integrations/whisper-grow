import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Agent definitions with tools
const conversationAgent = {
  name: "ConversationAgent",
  instructions: `You are the primary conversational AI for a personal knowledge management system. 
Your role is to:
- Have natural, helpful conversations with the user
- Understand their intent and decide which specialized agent to hand off to
- Ask clarifying questions when needed
- Provide verbal confirmations and summaries

When the user wants to:
- Save information, create notes, tasks, or events → Transfer to CaptureAgent
- Research something or search the web → Transfer to ResearchAgent  
- Query their existing notes, calendar, or tasks → Transfer to QueryAgent

Be conversational, helpful, and proactive. Remember context from the conversation.`,
  tools: []
};

const captureAgent = {
  name: "CaptureAgent",
  instructions: `You specialize in capturing and organizing user's thoughts.
- Process what the user says and save it appropriately (note, task, or calendar event)
- Always categorize information intelligently
- Provide verbal confirmation of what was saved and where
- After saving, ask if there's anything else to capture

Use the save_thought tool to process and save user input.`,
  tools: [
    {
      type: "function",
      name: "save_thought",
      description: "Save user's thought as a note, task, or calendar event. The system will intelligently categorize and process it.",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "The user's thought to save"
          }
        },
        required: ["text"]
      }
    }
  ]
};

const researchAgent = {
  name: "ResearchAgent",
  instructions: `You specialize in research and information retrieval.
- Search the web for current information when asked
- Find connections in the user's knowledge graph
- Summarize findings verbally and clearly
- Offer to save important findings to notes

Use search_web for external information and query_knowledge for internal notes.`,
  tools: [
    {
      type: "function",
      name: "search_web",
      description: "Search the web for current information on a topic",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query"
          }
        },
        required: ["query"]
      }
    },
    {
      type: "function",
      name: "query_knowledge",
      description: "Search the user's existing notes using semantic similarity",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "What to search for in the user's notes"
          },
          limit: {
            type: "number",
            description: "Maximum number of notes to return (default 5)"
          }
        },
        required: ["query"]
      }
    }
  ]
};

const queryAgent = {
  name: "QueryAgent",
  instructions: `You specialize in answering questions about the user's data.
- Access calendar events, tasks, and notes
- Provide stats and insights
- Answer questions like "What did I learn about X?" or "When's my next meeting?"
- Be concise but thorough

Use the provided tools to fetch relevant data.`,
  tools: [
    {
      type: "function",
      name: "get_tasks",
      description: "Fetch user's tasks, optionally filtered",
      parameters: {
        type: "object",
        properties: {
          completed: {
            type: "boolean",
            description: "Filter by completion status"
          },
          limit: {
            type: "number",
            description: "Maximum number of tasks to return"
          }
        }
      }
    },
    {
      type: "function",
      name: "get_calendar_events",
      description: "Fetch user's calendar events",
      parameters: {
        type: "object",
        properties: {
          days_ahead: {
            type: "number",
            description: "Number of days to look ahead (default 7)"
          }
        }
      }
    },
    {
      type: "function",
      name: "query_knowledge",
      description: "Search the user's existing notes",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "What to search for"
          },
          limit: {
            type: "number",
            description: "Maximum number of notes to return"
          }
        },
        required: ["query"]
      }
    }
  ]
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  let openAIWs: WebSocket | null = null;
  let supabaseClient: any = null;
  let userId: string | null = null;
  let authToken: string | null = null;

  socket.onopen = async () => {
    console.log("Client WebSocket connected");
    
    // Get auth token from query params
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    authToken = token;
    
    if (!token) {
      console.error("No token provided");
      try { socket.send(JSON.stringify({ type: 'error', code: 'auth_missing', message: 'No authentication token provided' })); } catch (_) {}
      socket.close(1008, 'No token provided');
      return;
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}`, apikey: supabaseKey } }
    });

    // Verify user via client headers; fallback to decoding JWT
    let authErr: any = null;
    try {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      authErr = authError;
      if (user) {
        userId = user.id;
        console.log(`Authenticated user: ${user.id.substring(0, 8)}...`);
      }
    } catch (e) {
      authErr = e;
    }
    if (!userId) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.sub;
        console.warn('Supabase auth.getUser() failed, using JWT sub fallback:', userId?.substring(0,8));
      } catch (e) {
        console.error("Authentication failed:", authErr || e);
        try { socket.send(JSON.stringify({ type: 'error', code: 'auth_failed', message: `Authentication failed: ${authErr?.message || (e instanceof Error ? e.message : 'Invalid token')}` })); } catch (_) {}
        socket.close(1008, 'Authentication failed');
        return;
      }
    }

    // Connect to OpenAI Realtime API
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      socket.send(JSON.stringify({ type: 'error', message: 'OpenAI API key not configured' }));
      socket.close();
      return;
    }

    try {
      // Connect to OpenAI Realtime API (using subprotocols to pass key)
      try {
        socket.send(JSON.stringify({ type: 'status', message: 'Connecting to OpenAI…' }));
        openAIWs = new WebSocket(
          'wss://api.openai.com/v1/realtime?model=gpt-realtime',
          [
            'realtime',
            `openai-insecure-api-key.${OPENAI_API_KEY}`,
            'openai-beta.realtime=v1'
          ]
        );
      } catch (err) {
        console.error('WebSocket constructor failed:', err);
        try { socket.send(JSON.stringify({ type: 'error', code: 'openai_ws_init_failed', message: `Failed to initialize AI connection: ${err instanceof Error ? err.message : 'Unknown error'}` })); } catch (_) {}
        socket.close();
        return;
      }

      openAIWs.onopen = () => {
        console.log('Connected to OpenAI Realtime API');
        socket.send(JSON.stringify({ type: 'status', message: 'OpenAI connected' }));
        socket.send(JSON.stringify({ type: 'connected' }));
      };

      openAIWs.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        console.log("OpenAI message:", message.type);

        // Handle session.created - send configuration
        if (message.type === 'session.created') {
          const sessionUpdate = {
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              instructions: conversationAgent.instructions,
              voice: 'alloy',
              input_audio_format: 'pcm16',
              output_audio_format: 'pcm16',
              input_audio_transcription: {
                model: 'whisper-1'
              },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 1000
              },
              tools: [
                ...captureAgent.tools,
                ...researchAgent.tools,
                ...queryAgent.tools
              ],
              tool_choice: 'auto',
              temperature: 0.8,
              max_response_output_tokens: 4096
            }
          };
          console.log('Sending session.update to OpenAI');
          openAIWs?.send(JSON.stringify(sessionUpdate));
        }

        // Handle function calls
        if (message.type === 'response.function_call_arguments.done') {
          const { call_id, name, arguments: args } = message;
          console.log(`Function call: ${name}`, args);
          
          let result;
          try {
            const parsedArgs = JSON.parse(args);
            result = await handleToolCall(name, parsedArgs, supabaseClient, userId!, authToken!);
          } catch (error) {
            console.error(`Error executing ${name}:`, error);
            result = { error: (error as Error).message };
          }

          // Send function result back to OpenAI
          openAIWs?.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id,
              output: JSON.stringify(result)
            }
          }));
          openAIWs?.send(JSON.stringify({ type: 'response.create' }));
        }

        // Forward all messages to client
        socket.send(event.data);
      };

      openAIWs.onerror = (error) => {
        console.error('OpenAI WebSocket error:', error);
        try { socket.send(JSON.stringify({ type: 'error', message: 'OpenAI connection error' })); } catch (_) {}
      };

      openAIWs.onclose = (ev) => {
        console.log("OpenAI WebSocket closed", ev?.code, ev?.reason);
        try { 
          socket.send(JSON.stringify({ 
            type: 'error', 
            code: 'openai_ws_closed', 
            message: `AI connection closed${ev?.code ? ` (code: ${ev.code})` : ''}${ev?.reason ? `: ${ev.reason}` : ''}` 
          })); 
        } catch (_) {}
        socket.close();
      };

    } catch (error) {
      console.error("Error connecting to OpenAI:", error);
      socket.send(JSON.stringify({ type: 'error', message: 'Failed to connect to OpenAI' }));
      socket.close();
    }
  };

  socket.onmessage = (event) => {
    // Forward client messages to OpenAI
    if (openAIWs && openAIWs.readyState === WebSocket.OPEN) {
      openAIWs.send(event.data);
    }
  };

  socket.onclose = () => {
    console.log("Client WebSocket closed");
    if (openAIWs) {
      openAIWs.close();
    }
  };

  socket.onerror = (error) => {
    console.error("Client WebSocket error:", error);
  };

  return response;
});

// Tool execution handler
async function handleToolCall(toolName: string, args: any, supabaseClient: any, userId: string, authToken: string) {
  console.log(`Executing tool: ${toolName}`, args);

  switch (toolName) {
    case 'save_thought': {
      // Use existing process-smart-input edge function
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      
      const processResponse = await fetch(`${supabaseUrl}/functions/v1/process-smart-input`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: args.text })
      });
      
      if (!processResponse.ok) {
        const errorText = await processResponse.text();
        console.error('process-smart-input error:', processResponse.status, errorText);
        throw new Error(`Failed to save: ${errorText}`);
      }
      
      const data = await processResponse.json();
      
      // If it's a calendar event, sync it to Google Calendar
      if (data?.classification === 'EVENT' && data?.item?.id) {
        console.log('Syncing calendar event to Google Calendar:', data.item.id);
        
        const syncResponse = await fetch(`${supabaseUrl}/functions/v1/sync-to-google-calendar`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ eventId: data.item.id })
        });
        
        if (!syncResponse.ok) {
          console.error('Failed to sync to Google Calendar');
          return {
            success: true,
            result: data,
            warning: 'Event saved locally but failed to sync to Google Calendar'
          };
        }
        
        return {
          success: true,
          result: data,
          synced_to_google: true
        };
      }
      
      return { success: true, result: data };
    }

    case 'search_web': {
      // Simple web search using external API (you can replace with better service)
      const query = encodeURIComponent(args.query);
      const response = await fetch(`https://api.duckduckgo.com/?q=${query}&format=json`);
      const data = await response.json();
      return {
        success: true,
        results: data.AbstractText || data.RelatedTopics?.slice(0, 3).map((t: any) => t.Text) || []
      };
    }

    case 'query_knowledge': {
      // Generate embedding using OpenAI directly
      const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
      if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
      
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: args.query,
          model: 'text-embedding-3-small',
        }),
      });

      if (!embeddingResponse.ok) {
        throw new Error('Failed to generate query embedding');
      }

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.data[0].embedding;

      const { data: notes, error: notesError } = await supabaseClient
        .rpc('match_notes', {
          query_embedding: embedding,
          match_threshold: 0.7,
          match_count: args.limit || 5,
          user_id_param: userId
        });

      if (notesError) throw notesError;
      return { success: true, notes };
    }

    case 'get_tasks': {
      let query = supabaseClient
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (args.completed !== undefined) {
        query = query.eq('completed', args.completed);
      }

      if (args.limit) {
        query = query.limit(args.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { success: true, tasks: data };
    }

    case 'get_calendar_events': {
      const daysAhead = args.days_ahead || 7;
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabaseClient
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', startDate)
        .lte('start_time', endDate)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return { success: true, events: data };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
