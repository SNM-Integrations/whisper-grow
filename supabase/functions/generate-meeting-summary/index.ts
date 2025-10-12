import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { meetingId } = await req.json();
    if (!meetingId) throw new Error('Meeting ID required');

    // Fetch meeting data
    const { data: meeting, error: meetingError } = await supabaseClient
      .from('meetings')
      .select('*, tasks(*), notes(*)')
      .eq('id', meetingId)
      .single();

    if (meetingError) throw meetingError;

    // Fetch AI settings
    const { data: aiSettings } = await supabaseClient
      .from('ai_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const prompt = `Analyze this meeting and generate a comprehensive summary:

Meeting: ${meeting.title}
Duration: ${meeting.start_time} to ${meeting.end_time || 'ongoing'}
Participants: ${meeting.participants?.join(', ') || 'Not specified'}

Transcript:
${meeting.transcript || 'No transcript available'}

Action Items Created: ${meeting.tasks?.length || 0}
${meeting.tasks?.map((t: any) => `- ${t.title}`).join('\n') || 'None'}

Key Decisions/Notes: ${meeting.notes?.length || 0}
${meeting.notes?.map((n: any) => `- ${n.content.substring(0, 100)}...`).join('\n') || 'None'}

Generate a structured summary with:
1. **Executive Summary** (2-3 sentences)
2. **Key Discussion Points** (bullet points)
3. **Decisions Made** (bullet points)
4. **Action Items** (bullet points with owners if mentioned)
5. **Next Steps** (what needs to happen next)
6. **Topics for Follow-up** (unresolved items)

Be concise but comprehensive.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiSettings?.model || 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a meeting intelligence assistant that creates clear, actionable summaries.' },
          { role: 'user', content: prompt }
        ],
        temperature: aiSettings?.temperature || 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices[0].message.content;

    // Update meeting with summary
    await supabaseClient
      .from('meetings')
      .update({ summary })
      .eq('id', meetingId);

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating meeting summary:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});