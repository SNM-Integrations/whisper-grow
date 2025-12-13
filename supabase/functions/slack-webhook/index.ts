import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-slack-signature, x-slack-request-timestamp',
};

// Verify Slack request signature
async function verifySlackRequest(
  body: string,
  timestamp: string,
  signature: string,
  signingSecret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const baseString = `v0:${timestamp}:${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(baseString));
  const computedSignature = "v0=" + Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return computedSignature === signature;
}

// Get Slack settings from integration_settings
async function getSlackSettings(supabaseClient: any): Promise<{ botToken: string; signingSecret: string } | null> {
  // Try to get org-level settings first, then personal
  const { data, error } = await supabaseClient
    .from('integration_settings')
    .select('settings')
    .eq('integration_type', 'slack')
    .limit(1)
    .single();
  
  if (error || !data?.settings) {
    console.error('No Slack settings found:', error);
    return null;
  }
  
  return {
    botToken: data.settings.bot_token,
    signingSecret: data.settings.signing_secret,
  };
}

// Post message to Slack
async function postSlackMessage(
  botToken: string,
  channel: string,
  text: string,
  threadTs?: string
): Promise<void> {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel,
      text,
      thread_ts: threadTs,
    }),
  });
  
  const result = await response.json();
  if (!result.ok) {
    console.error('Slack API error:', result.error);
  }
}

// Call the chat edge function internally
async function callChatFunction(
  messages: Array<{ role: string; content: string }>,
  accessToken: string,
  supabaseUrl: string
): Promise<string> {
  const response = await fetch(`${supabaseUrl}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    throw new Error(`Chat function error: ${response.status}`);
  }

  // Handle streaming response - collect all chunks
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  let fullContent = '';
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.choices?.[0]?.delta?.content) {
            fullContent += parsed.choices[0].delta.content;
          }
        } catch (e) {
          // Not JSON, might be raw text
          fullContent += data;
        }
      }
    }
  }

  return fullContent || 'I processed your request but have no response to display.';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://pccvvqmrwbcdjgkyteqn.supabase.co';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseServiceKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    }

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const bodyText = await req.text();
    const body = JSON.parse(bodyText);

    console.log('Slack webhook received:', JSON.stringify(body, null, 2));

    // Handle Slack URL verification challenge
    if (body.type === 'url_verification') {
      console.log('Handling URL verification challenge');
      return new Response(JSON.stringify({ challenge: body.challenge }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Slack settings
    const slackSettings = await getSlackSettings(supabaseAdmin);
    if (!slackSettings) {
      console.error('Slack settings not configured');
      return new Response(JSON.stringify({ error: 'Slack not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify request signature
    const timestamp = req.headers.get('x-slack-request-timestamp') || '';
    const signature = req.headers.get('x-slack-signature') || '';
    
    // Skip verification in development or if headers missing
    if (timestamp && signature && slackSettings.signingSecret) {
      const isValid = await verifySlackRequest(bodyText, timestamp, signature, slackSettings.signingSecret);
      if (!isValid) {
        console.error('Invalid Slack signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle event callbacks
    if (body.type === 'event_callback') {
      const event = body.event;
      
      // Ignore bot messages to prevent loops
      if (event.bot_id || event.subtype === 'bot_message') {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Handle app_mention or message events
      if (event.type === 'app_mention' || event.type === 'message') {
        const slackUserId = event.user;
        const channelId = event.channel;
        const threadTs = event.thread_ts || event.ts; // Use thread_ts if in thread, otherwise message ts
        const messageText = event.text?.replace(/<@[A-Z0-9]+>/g, '').trim() || ''; // Remove @mentions
        const workspaceId = body.team_id;

        console.log(`Processing message from ${slackUserId}: ${messageText}`);

        // Look up user mapping
        const { data: userMapping, error: mappingError } = await supabaseAdmin
          .from('slack_user_mappings')
          .select('user_id')
          .eq('slack_user_id', slackUserId)
          .eq('slack_workspace_id', workspaceId)
          .single();

        if (mappingError || !userMapping) {
          console.log('User not linked, sending help message');
          await postSlackMessage(
            slackSettings.botToken,
            channelId,
            "👋 I don't recognize you yet! Please link your Slack account in the Second Brain app settings.",
            threadTs
          );
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const userId = userMapping.user_id;

        // Get or create conversation for this thread
        let conversationId: string;
        const { data: existingConvo } = await supabaseAdmin
          .from('slack_conversations')
          .select('conversation_id')
          .eq('slack_channel_id', channelId)
          .eq('slack_thread_ts', threadTs)
          .eq('slack_workspace_id', workspaceId)
          .single();

        if (existingConvo) {
          conversationId = existingConvo.conversation_id;
        } else {
          // Create new conversation
          const { data: newConvo, error: convoError } = await supabaseAdmin
            .from('conversations')
            .insert({
              user_id: userId,
              title: `Slack: ${messageText.substring(0, 50)}...`,
              visibility: 'personal',
            })
            .select('id')
            .single();

          if (convoError || !newConvo) {
            throw new Error('Failed to create conversation');
          }

          conversationId = newConvo.id;

          // Link to Slack thread
          await supabaseAdmin
            .from('slack_conversations')
            .insert({
              conversation_id: conversationId,
              slack_channel_id: channelId,
              slack_thread_ts: threadTs,
              slack_workspace_id: workspaceId,
            });
        }

        // Save user message
        await supabaseAdmin
          .from('messages')
          .insert({
            conversation_id: conversationId,
            user_id: userId,
            role: 'user',
            content: messageText,
          });

        // Fetch conversation history for context
        const { data: history } = await supabaseAdmin
          .from('messages')
          .select('role, content')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(20);

        const messages = (history || []).map(m => ({
          role: m.role as string,
          content: m.content as string,
        }));

        // Call chat function with service role
        try {
          // Send typing indicator
          await postSlackMessage(slackSettings.botToken, channelId, "🤔 Thinking...", threadTs);

          const aiResponse = await callChatFunction(messages, supabaseServiceKey, supabaseUrl);

          // Save AI response
          await supabaseAdmin
            .from('messages')
            .insert({
              conversation_id: conversationId,
              user_id: userId,
              role: 'assistant',
              content: aiResponse,
            });

          // Post response to Slack
          await postSlackMessage(slackSettings.botToken, channelId, aiResponse, threadTs);
        } catch (chatError) {
          console.error('Chat function error:', chatError);
          await postSlackMessage(
            slackSettings.botToken,
            channelId,
            "Sorry, I encountered an error processing your request. Please try again.",
            threadTs
          );
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Slack webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
