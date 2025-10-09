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
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    console.log('Creating ephemeral Realtime session...');

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "alloy",
        instructions: `You are a personal AI assistant with access to the user's knowledge base, tasks, and calendar.

Your capabilities:
- Save thoughts and notes for the user
- Search through their existing knowledge base
- View and manage their tasks
- Check their calendar events

Be conversational, helpful, and proactive. When the user asks questions, use your tools to provide accurate information from their data.`,
        modalities: ["text", "audio"],
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1000
        },
        tools: [
          {
            type: "function",
            name: "save_thought",
            description: "Save a thought, note, or idea to the user's knowledge base. Use this when the user wants to remember something.",
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
            description: "Search through the user's existing notes and knowledge base. Use this to answer questions about what they've saved.",
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
                completed: { type: "boolean", description: "Filter by completion status (true for completed, false for incomplete, omit for all)" },
                limit: { type: "number", description: "Maximum number of tasks to return (default 10)" }
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
                start_date: { type: "string", description: "Start date in ISO format (e.g., 2024-01-01)" },
                end_date: { type: "string", description: "End date in ISO format (e.g., 2024-01-31)" }
              },
              required: ["start_date", "end_date"]
            }
          }
        ],
        tool_choice: "auto",
        temperature: 0.8
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`Failed to create session: ${errorText}`);
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
