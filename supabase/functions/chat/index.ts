import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// n8n MCP endpoint
const N8N_MCP_URL = "https://n8n-08HY.sliplane.app/mcp/721deb26-44e7-40e0-87a5-60204e614109";

// Tool definitions for the AI
const tools = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a new task for the user",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          description: { type: "string", description: "Optional task description" },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Task priority" },
          due_date: { type: "string", description: "Due date in ISO format (YYYY-MM-DD)" }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_tasks",
      description: "Get the user's tasks, optionally filtered",
      parameters: {
        type: "object",
        properties: {
          completed: { type: "boolean", description: "Filter by completion status" },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Filter by priority" },
          limit: { type: "number", description: "Maximum number of tasks to return" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_note",
      description: "Create a new note for the user",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "Note content" }
        },
        required: ["content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_notes",
      description: "Search through the user's notes",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          limit: { type: "number", description: "Maximum number of notes to return" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description: "Create a new calendar event",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Event title" },
          description: { type: "string", description: "Event description" },
          start_time: { type: "string", description: "Start time in ISO format" },
          end_time: { type: "string", description: "End time in ISO format" },
          location: { type: "string", description: "Event location" }
        },
        required: ["title", "start_time", "end_time"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_calendar_events",
      description: "Get calendar events for a date range",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Start date in ISO format" },
          end_date: { type: "string", description: "End date in ISO format" }
        },
        required: ["start_date", "end_date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_contact",
      description: "Create a new CRM contact",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Contact name" },
          email: { type: "string", description: "Contact email" },
          phone: { type: "string", description: "Contact phone" },
          company: { type: "string", description: "Company name" },
          role: { type: "string", description: "Contact's role/title" },
          relationship: { type: "string", enum: ["friend", "colleague", "partner", "network"], description: "Relationship type with the contact" },
          notes: { type: "string", description: "Notes about the contact" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_company",
      description: "Create a new CRM company",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Company name" },
          industry: { type: "string", description: "Industry" },
          website: { type: "string", description: "Company website" },
          employees: { type: "number", description: "Number of employees" },
          notes: { type: "string", description: "Notes about the company" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_deal",
      description: "Create a new CRM deal",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Deal title" },
          value: { type: "number", description: "Deal value" },
          stage: { type: "string", enum: ["lead", "qualified", "proposal", "negotiation", "closed"], description: "Deal stage" },
          expected_close_date: { type: "string", description: "Expected close date in ISO format" },
          notes: { type: "string", description: "Notes about the deal" }
        },
        required: ["title"]
      }
    }
  },
  // n8n workflow tools
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Send an email via Gmail. Use this when the user asks to send an email or message someone.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address" },
          subject: { type: "string", description: "Email subject" },
          message: { type: "string", description: "Email body content" }
        },
        required: ["to", "subject", "message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_google_calendar_events",
      description: "Get events from Google Calendar for a date range",
      parameters: {
        type: "object",
        properties: {
          calendar: { type: "string", description: "Calendar email (e.g. nils.wahlin@snmintegrations.se or samuel.ekeblad@snmintegrations.se)" },
          after: { type: "string", description: "Start date in ISO format" },
          before: { type: "string", description: "End date in ISO format" },
          return_all: { type: "boolean", description: "Return all events" }
        },
        required: ["calendar", "after", "before"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Check availability in Google Calendar for a person",
      parameters: {
        type: "object",
        properties: {
          calendar: { type: "string", description: "Calendar email (nils.wahlin@snmintegrations.se or samuel.ekeblad@snmintegrations.se)" },
          start_time: { type: "string", description: "Start time in ISO format" },
          end_time: { type: "string", description: "End time in ISO format" }
        },
        required: ["calendar", "start_time", "end_time"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "book_meeting",
      description: "Book a meeting in Google Calendar in Europe/Stockholm timezone",
      parameters: {
        type: "object",
        properties: {
          start: { type: "string", description: "Start time in RFC3339 format with offset (e.g. 2025-09-02T09:00:00+02:00)" },
          end: { type: "string", description: "End time in RFC3339 format with offset (e.g. 2025-09-02T10:00:00+02:00)" },
          description: { type: "string", description: "Meeting description/title" }
        },
        required: ["start", "end", "description"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current information, news, or any web-based content",
      parameters: {
        type: "object",
        properties: {
          input: { type: "string", description: "Search query" }
        },
        required: ["input"]
      }
    }
  }
];

// Helper function to call n8n MCP workflows
async function callN8nWorkflow(
  toolName: string,
  params: Record<string, unknown>
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  console.log(`Calling n8n workflow: ${toolName} with params:`, params);
  
  try {
    const response = await fetch(N8N_MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "tools/call",
        params: {
          name: toolName,
          arguments: params
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`n8n workflow error: ${response.status}`, errorText);
      throw new Error(`n8n workflow failed: ${response.status}`);
    }

    const result = await response.json();
    console.log(`n8n workflow result:`, result);
    
    if (result.error) {
      throw new Error(result.error.message || "n8n workflow error");
    }
    
    return { success: true, result: result.result };
  } catch (error) {
    console.error(`n8n workflow error:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Execute tool calls - using any type to avoid Supabase type inference issues in edge functions
async function executeTool(
  toolName: string, 
  args: Record<string, unknown>, 
  supabaseClient: any,
  userId: string
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  console.log(`Executing tool: ${toolName} with args:`, args);
  
  try {
    switch (toolName) {
      case "create_task": {
        const { data, error } = await supabaseClient
          .from("tasks")
          .insert({
            user_id: userId,
            title: args.title as string,
            description: args.description as string || null,
            priority: args.priority as string || "medium",
            due_date: args.due_date ? new Date(args.due_date as string).toISOString() : null,
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, result: data };
      }
      
      case "get_tasks": {
        let query = supabaseClient
          .from("tasks")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        
        if (typeof args.completed === "boolean") {
          query = query.eq("completed", args.completed);
        }
        if (args.priority) {
          query = query.eq("priority", args.priority);
        }
        if (args.limit) {
          query = query.limit(args.limit as number);
        } else {
          query = query.limit(10);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return { success: true, result: data };
      }
      
      case "create_note": {
        const { data, error } = await supabaseClient
          .from("notes")
          .insert({
            user_id: userId,
            content: args.content as string,
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, result: data };
      }
      
      case "search_notes": {
        const { data, error } = await supabaseClient
          .from("notes")
          .select("*")
          .eq("user_id", userId)
          .ilike("content", `%${args.query}%`)
          .limit((args.limit as number) || 5);
        
        if (error) throw error;
        return { success: true, result: data };
      }
      
      case "create_calendar_event": {
        const { data, error } = await supabaseClient
          .from("calendar_events")
          .insert({
            user_id: userId,
            title: args.title as string,
            description: args.description as string || null,
            start_time: args.start_time as string,
            end_time: args.end_time as string,
            location: args.location as string || null,
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, result: data };
      }
      
      case "get_calendar_events": {
        const { data, error } = await supabaseClient
          .from("calendar_events")
          .select("*")
          .eq("user_id", userId)
          .gte("start_time", args.start_date as string)
          .lte("start_time", args.end_date as string)
          .order("start_time", { ascending: true });
        
        if (error) throw error;
        return { success: true, result: data };
      }
      
      case "create_contact": {
        const relationship = args.relationship as string || "network";
        const { data, error } = await supabaseClient
          .from("contacts")
          .insert({
            user_id: userId,
            name: args.name as string,
            email: args.email as string || null,
            phone: args.phone as string || null,
            company: args.company as string || null,
            role: args.role as string || null,
            notes: args.notes as string || null,
            tags: [relationship],
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, result: data };
      }
      
      case "create_company": {
        const { data, error } = await supabaseClient
          .from("companies")
          .insert({
            user_id: userId,
            name: args.name as string,
            industry: args.industry as string || null,
            website: args.website as string || null,
            employees: args.employees as number || null,
            notes: args.notes as string || null,
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, result: data };
      }
      
      case "create_deal": {
        const { data, error } = await supabaseClient
          .from("deals")
          .insert({
            user_id: userId,
            title: args.title as string,
            value: args.value as number || 0,
            stage: args.stage as string || "lead",
            expected_close_date: args.expected_close_date as string || null,
            notes: args.notes as string || null,
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, result: data };
      }
      
      // n8n workflow tools
      case "send_email": {
        return await callN8nWorkflow("Gmail", {
          To: args.to as string,
          Subject: args.subject as string,
          Message: args.message as string,
        });
      }
      
      case "get_google_calendar_events": {
        return await callN8nWorkflow("Get_many_events_in_Google_Calendar", {
          Calendar: args.calendar as string,
          After: args.after as string,
          Before: args.before as string,
          Return_All: args.return_all ?? false,
        });
      }
      
      case "check_availability": {
        return await callN8nWorkflow("Availability", {
          Calendar: args.calendar as string,
          Start_Time: args.start_time as string,
          End_Time: args.end_time as string,
        });
      }
      
      case "book_meeting": {
        return await callN8nWorkflow("Book_Meeting", {
          Start: args.start as string,
          End: args.end as string,
          Description: args.description as string,
        });
      }
      
      case "web_search": {
        return await callN8nWorkflow("search", {
          input: args.input as string,
        });
      }
      
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    console.error(`Tool execution error:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

const systemPrompt = `You are a personal AI assistant - a "Second Brain" that helps the user manage their knowledge, tasks, calendar, relationships, and communications. Be concise, helpful, and remember context from the conversation.

You have access to tools to actually perform actions. When the user asks you to:
- Add/create a task → use create_task
- Show/list tasks → use get_tasks  
- Add/create a note → use create_note
- Search notes → use search_notes
- Add/create a calendar event or meeting → use create_calendar_event
- Show calendar events → use get_calendar_events
- Add/create a contact → use create_contact
- Add/create a company → use create_company
- Add/create a deal → use create_deal

EXTERNAL INTEGRATIONS (via n8n):
- Send an email → use send_email (requires: to, subject, message)
- Get Google Calendar events → use get_google_calendar_events (calendars: nils.wahlin@snmintegrations.se, samuel.ekeblad@snmintegrations.se)
- Check someone's availability → use check_availability
- Book a meeting in Google Calendar → use book_meeting (use RFC3339 format with timezone offset, e.g. 2025-12-09T09:00:00+01:00)
- Search the web for current info → use web_search

IMPORTANT: 
- Always use the appropriate tool when the user asks you to create, add, show, send, search, or book something.
- After using a tool successfully, confirm what was done briefly.
- For dates, use ISO format (YYYY-MM-DD for dates, full ISO for datetimes).
- For Google Calendar bookings, use RFC3339 with Europe/Stockholm timezone offset (+01:00 in winter, +02:00 in summer).
- Be direct and actionable. Avoid unnecessary pleasantries.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get auth user - support both user JWT and service role with user_id header
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const userIdHeader = req.headers.get("x-user-id");
    
    let userId: string;
    let supabaseClient: any;
    
    // Check if this is a service-to-service call (from slack-webhook etc.)
    if (authHeader?.includes(serviceRoleKey || "") && userIdHeader) {
      // Service role call with explicit user ID
      userId = userIdHeader;
      supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        serviceRoleKey ?? "",
      );
      console.log("Service-to-service call for user:", userId);
    } else {
      // Regular user auth
      supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader ?? "" } } }
      );

      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user) {
        console.error("Auth error:", authError);
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    console.log("Chat request from user:", userId, "conversationId:", conversationId);

    // First call - check if AI wants to use tools
    const initialResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools: tools,
        tool_choice: "auto",
      }),
    });

    if (!initialResponse.ok) {
      const errorText = await initialResponse.text();
      console.error("AI gateway error:", initialResponse.status, errorText);
      
      if (initialResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (initialResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits depleted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const initialData = await initialResponse.json();
    const assistantMessage = initialData.choices?.[0]?.message;
    
    console.log("Initial response:", JSON.stringify(assistantMessage, null, 2));

    // Check if there are tool calls
    if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log("Tool calls detected:", assistantMessage.tool_calls.length);
      
      // Execute all tool calls
      const toolResults = [];
      for (const toolCall of assistantMessage.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await executeTool(toolCall.function.name, args, supabaseClient, userId);
        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          content: JSON.stringify(result),
        });
        console.log(`Tool ${toolCall.function.name} result:`, result);
      }

      // Second call - get AI response with tool results (streaming)
      const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
            assistantMessage,
            ...toolResults,
          ],
          stream: true,
        }),
      });

      if (!finalResponse.ok) {
        const errorText = await finalResponse.text();
        console.error("Final AI response error:", errorText);
        throw new Error("Failed to get final AI response");
      }

      console.log("Streaming final response with tool results");
      return new Response(finalResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No tool calls - stream the regular response
    console.log("No tool calls, streaming regular response");
    
    // Re-call with streaming since initial call was non-streaming
    const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!streamResponse.ok) {
      throw new Error("Failed to get streaming response");
    }

    return new Response(streamResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
