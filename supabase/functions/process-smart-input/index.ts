import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract the JWT token and create an RLS-aware client for DB access
    const token = authHeader.replace('Bearer ', '');
    const db = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Not authenticated');

    console.log('Processing input:', text);

    // Get user's categories for context
    const { data: categories } = await db
      .from('categories')
      .select('name, id')
      .eq('user_id', user.id);

    const categoryList = categories?.map(c => c.name).join(', ') || 'none';

    // Call Lovable AI to classify and extract data
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a smart assistant that categorizes user input into three types: EVENT, TASK, or NOTE.

CRITICAL Rules for classification:
- EVENT: ALWAYS classify as EVENT if the input mentions:
  * "add to calendar", "calendar", "schedule", "appointment", "meeting"
  * Specific dates (e.g., "27th of October", "next Monday", "tomorrow at 3pm")
  * Time-based commitments or deadlines with specific dates
  * Examples: "Add to my calendar X on Y date", "Schedule meeting for...", "Appointment on..."
  
- TASK: Only classify as TASK if:
  * Contains action verbs like "need to", "must", "should" WITHOUT calendar-related words
  * Has a deadline but user does NOT mention calendar/schedule
  * To-do items, action items
  
- NOTE: Only classify as NOTE if:
  * General information, thoughts, ideas, learnings
  * No specific dates or calendar mentions
  * Observations, reflections, or knowledge capture

Extract relevant information:
For EVENT: title, date, time (default to 09:00 if not specified), duration_minutes (default to 60), location
For TASK: title, description, due_date, priority (high/medium/low)
For NOTE: content, suggested category

User's existing categories: ${categoryList}

IMPORTANT: When user says "add to my calendar" or mentions "calendar", ALWAYS classify as EVENT, even if phrased informally.

Respond ONLY with valid JSON in this exact format:
{
  "type": "EVENT|TASK|NOTE",
  "data": {
    // for EVENT
    "title": "string",
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "duration_minutes": number,
    "location": "string or null",
    "description": "string or null",
    // for TASK
    "title": "string",
    "description": "string",
    "due_date": "YYYY-MM-DD or null",
    "priority": "high|medium|low",
    // for NOTE
    "content": "string",
    "category": "string (existing or new)"
  }
}`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let aiContent = aiData.choices?.[0]?.message?.content ?? '';
    console.log('AI raw response:', aiContent);

    // Parse the JSON response robustly
    const stripCodeFences = (s: string) => s.replace(/```(?:json)?/g, '').trim();
    const extractJson = (s: string) => {
      const start = s.indexOf('{');
      const end = s.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) return s.slice(start, end + 1);
      return s;
    };

    let result: any;
    try {
      result = JSON.parse(extractJson(stripCodeFences(aiContent)));
    } catch (e) {
      console.error('Failed to parse AI JSON. Content was:', aiContent);
      throw new Error('Invalid AI JSON response');
    }

    // Normalize and validate classification type
    let classification = result.type?.toUpperCase();
    
    // Guard against invalid classification or missing calendar cues
    if (!['EVENT', 'TASK', 'NOTE'].includes(classification)) {
      console.log('Unknown classification:', result.type, 'checking for calendar cues...');
      // Fallback: if text contains calendar cues, treat as event
      const calendarCues = /\b(calendar|schedule|meeting|appointment|at \d|on (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d))\b/i;
      if (calendarCues.test(text)) {
        console.log('Detected calendar cues, treating as EVENT');
        classification = 'EVENT';
      } else {
        console.log('No calendar cues, defaulting to NOTE');
        classification = 'NOTE';
      }
    }

    console.log('Final classification:', classification);

    // Now actually create the record based on type
    let createdItem: any = null;

    if (classification === 'EVENT' && result.data) {
      const eventData = result.data;
      // Parse date and time, create proper UTC ISO strings
      const dateTimeStr = `${eventData.date}T${eventData.time}:00`;
      const startMs = Date.parse(dateTimeStr);
      const durationMs = (eventData.duration_minutes || 60) * 60000;
      const startDateTime = new Date(startMs).toISOString();
      const endDateTime = new Date(startMs + durationMs).toISOString();

      console.log('Creating event with UTC times:', { startDateTime, endDateTime });

      const { data: event, error: eventError } = await db
        .from('calendar_events')
        .insert({
          user_id: user.id,
          title: eventData.title,
          description: eventData.description || null,
          start_time: startDateTime,
          end_time: endDateTime,
          location: eventData.location || null,
          is_synced: false
        })
        .select()
        .single();

      if (eventError) throw eventError;
      createdItem = { type: 'event', data: event };

      // Try to sync to Google Calendar if connected
      let syncStatus = 'not_attempted';
      try {
        const { data: syncResult, error: syncError } = await db.functions.invoke('sync-to-google-calendar', {
          body: { eventId: event.id }
        });
        if (syncError) {
          console.log('Google Calendar sync failed:', syncError);
          syncStatus = 'failed';
        } else {
          console.log('Event synced to Google Calendar:', syncResult);
          syncStatus = 'success';
        }
      } catch (syncErr) {
        console.log('Google Calendar sync skipped or failed:', syncErr);
        syncStatus = 'skipped';
      }
      
      // Add sync status to response
      createdItem.sync_status = syncStatus;

    } else if (classification === 'TASK' && result.data) {
      const taskData = result.data;

      const { data: task, error: taskError } = await db
        .from('tasks')
        .insert({
          user_id: user.id,
          title: taskData.title,
          description: taskData.description || null,
          due_date: taskData.due_date || null,
          priority: taskData.priority || 'medium',
          completed: false
        })
        .select()
        .single();

      if (taskError) throw taskError;
      createdItem = { type: 'task', data: task };

    } else if (classification === 'NOTE' && result.data) {
      const noteData = result.data;

      // Find or create category
      let categoryId = null;
      if (noteData.category) {
        const existingCategory = categories?.find(c => c.name.toLowerCase() === noteData.category.toLowerCase());
        if (existingCategory) {
          categoryId = existingCategory.id;
        } else {
          const { data: newCategory, error: catError } = await db
            .from('categories')
            .insert({
              user_id: user.id,
              name: noteData.category
            })
            .select()
            .single();
          
          if (!catError && newCategory) {
            categoryId = newCategory.id;
          }
        }
      }

      const { data: note, error: noteError } = await db
        .from('notes')
        .insert({
          user_id: user.id,
          content: noteData.content,
          category_id: categoryId,
          note_type: 'original'
        })
        .select()
        .single();

      if (noteError) throw noteError;
      createdItem = { type: 'note', data: note };
    }

    return new Response(JSON.stringify({
      // Backward-compatible fields for clients
      type: classification,
      data: result?.data,
      classification: classification, // simple string for quick checks
      item: createdItem ? createdItem.data : null, // created DB record, if any
      item_type: createdItem ? createdItem.type : null,
      sync_status: createdItem?.sync_status || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
