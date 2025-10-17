import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentType, meetingId } = await req.json();
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    console.log('Creating ephemeral Realtime session for agent:', agentType);

    // Define agent-specific instructions and tools
    let instructions = '';
    let tools = [];

    if (agentType === 'meeting') {
      instructions = `You are an AI meeting assistant that helps capture and organize meeting information in real-time.

Your role during meetings:
- Listen actively to the conversation
- Identify and extract action items automatically
- Capture key decisions and important points
- Track meeting topics and participants

When you hear phrases like "we need to", "someone should", "I'll", "let's", "can you", "action item", or task-related language, immediately save it as an action item.

When key decisions are made, capture them with context.

Be proactive but not intrusive. Your goal is to let humans focus on the conversation while you handle the documentation.`;

      tools = [
        {
          type: "function",
          name: "save_action_item",
          description: "Create a task/action item from the meeting. Use when someone mentions something that needs to be done.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Clear, actionable task title" },
              description: { type: "string", description: "Additional context or details" },
              priority: { type: "string", enum: ["low", "medium", "high"], description: "Task priority" },
              owner: { type: "string", description: "Person responsible (if mentioned)" }
            },
            required: ["title", "priority"]
          }
        },
        {
          type: "function",
          name: "save_decision",
          description: "Capture a key decision or important point from the meeting.",
          parameters: {
            type: "object",
            properties: {
              decision: { type: "string", description: "The decision or key point" },
              context: { type: "string", description: "Why it was decided or additional context" }
            },
            required: ["decision"]
          }
        },
        {
          type: "function",
          name: "update_meeting_participants",
          description: "Update the list of meeting participants.",
          parameters: {
            type: "object",
            properties: {
              participants: { type: "array", items: { type: "string" }, description: "List of participant names" }
            },
            required: ["participants"]
          }
        },
        {
          type: "function",
          name: "query_knowledge",
          description: "Search the user's knowledge base for relevant information during the meeting.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "The search query" }
            },
            required: ["query"]
          }
        }
      ];
    } else {
      // Default conversation agent with smart mode switching
      instructions = `You are a personal AI assistant with access to the user's knowledge base, tasks, and calendar.

**Response Modes:**

1. **ACTIVE MODE (Default)**: Respond naturally to all user input
   - Answer questions immediately
   - Confirm actions ("I'll add that to your calendar for you")
   - Have natural conversations
   - Use tools proactively (save_thought, create_calendar_event, etc.)

2. **PASSIVE MODE**: Switch to silent listening when user says phrases like:
   - "Let me just rant for a bit"
   - "I'm getting down my thoughts"
   - "Just recording my ideas"
   - "Don't interrupt, I'm thinking"
   - Or any indication they want to speak uninterrupted
   
   In passive mode:
   - Respond ONLY with "I'm listening" or similar brief acknowledgment, then go silent
   - Continue using tools silently (save_thought for important points)
   - DO NOT speak again unless you hear trigger phrases like:
     * "Hey assistant" / "Question" / "What do you think"
     * Direct questions to you
     * User asking for help
   - When triggered, analyze the LAST 20-30 seconds of context before responding

3. **Context-Aware Responses**: When coming out of passive mode, reference what they just said
   Example: User rants for 2 minutes, then says "Hey assistant, does this make sense?"
   You should respond: "Yes, based on what you just described about [topic from last 30s]..."

**Tools Usage:**
- Use save_thought silently in passive mode for key insights
- Announce tool use in active mode ("I've created that event")
- Be proactive but respectful of the mode`;

      tools = [
        {
          type: "function",
          name: "save_thought",
          description: "Save a thought, note, or idea to the user's knowledge base.",
          parameters: {
            type: "object",
            properties: {
              text: { type: "string", description: "The thought or note to save" }
            },
            required: ["text"]
          }
        },
        {
          type: "function",
          name: "query_knowledge",
          description: "Search through the user's existing notes and knowledge base.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "The search query" }
            },
            required: ["query"]
          }
        },
        {
          type: "function",
          name: "get_tasks",
          description: "Get the user's tasks, optionally filtered by completion status.",
          parameters: {
            type: "object",
            properties: {
              completed: { type: "boolean", description: "Filter by completion status" },
              limit: { type: "number", description: "Maximum number of tasks to return" }
            }
          }
        },
        {
          type: "function",
          name: "get_calendar_events",
          description: "Get the user's calendar events within a date range.",
          parameters: {
            type: "object",
            properties: {
              start_date: { type: "string", description: "Start date in ISO format" },
              end_date: { type: "string", description: "End date in ISO format" }
            },
            required: ["start_date", "end_date"]
          }
        },
        {
          type: "function",
          name: "create_calendar_event",
          description: "Create a new calendar event when user mentions meetings or appointments.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "Event title" },
              start_time: { type: "string", description: "ISO datetime for event start" },
              end_time: { type: "string", description: "ISO datetime for event end (optional, defaults to 1 hour)" },
              description: { type: "string", description: "Event description or notes" },
              location: { type: "string", description: "Event location if mentioned" }
            },
            required: ["title", "start_time"]
          }
        }
      ];
    }

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "alloy",
        instructions,
        modalities: ["text", "audio"],
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1000
        },
        tools,
        tool_choice: "auto",
        temperature: 0.8
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required, please add funds to your AI provider.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'AI provider error', details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sessionData = await response.json();
    console.log('Session created successfully');

    return new Response(JSON.stringify(sessionData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating Realtime session:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
