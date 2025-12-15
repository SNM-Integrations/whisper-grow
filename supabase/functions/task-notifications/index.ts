import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Notification interval mapping to milliseconds
const NOTIFICATION_INTERVALS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '48h': 48 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
};

// Post message to Slack
async function postSlackMessage(
  botToken: string,
  channel: string,
  text: string
): Promise<boolean> {
  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        text,
        mrkdwn: true,
      }),
    });
    
    const result = await response.json();
    if (!result.ok) {
      console.error('Slack API error:', result.error);
      return false;
    }
    console.log(`Message sent to channel ${channel}`);
    return true;
  } catch (error) {
    console.error('Error posting to Slack:', error);
    return false;
  }
}

// Get Slack settings for an organization
async function getSlackSettings(
  supabaseClient: any,
  organizationId: string
): Promise<{ botToken: string; notificationChannel: string } | null> {
  const { data, error } = await supabaseClient
    .from('integration_settings')
    .select('settings')
    .eq('integration_type', 'slack')
    .eq('organization_id', organizationId)
    .single();
  
  if (error || !data?.settings?.bot_token) {
    console.log(`No Slack settings found for org ${organizationId}`);
    return null;
  }
  
  return {
    botToken: data.settings.bot_token,
    notificationChannel: data.settings.notification_channel || data.settings.default_channel || null,
  };
}

// Get contact name by ID
async function getContactName(supabaseClient: any, contactId: string): Promise<string | null> {
  const { data } = await supabaseClient
    .from('contacts')
    .select('name')
    .eq('id', contactId)
    .single();
  
  return data?.name || null;
}

// Get Slack user ID for a contact if mapped
async function getSlackUserForContact(
  supabaseClient: any,
  contactId: string,
  organizationId: string
): Promise<string | null> {
  // First get the contact's name/email
  const { data: contact } = await supabaseClient
    .from('contacts')
    .select('name, email')
    .eq('id', contactId)
    .single();
  
  if (!contact) return null;
  
  // Try to find a Slack user mapping by username or email
  const { data: mapping } = await supabaseClient
    .from('slack_user_mappings')
    .select('slack_user_id')
    .eq('organization_id', organizationId)
    .or(`slack_username.ilike.%${contact.name}%`)
    .limit(1)
    .single();
  
  return mapping?.slack_user_id || null;
}

// Format time remaining as human-readable string
function formatTimeRemaining(ms: number): string {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  } else {
    return 'less than an hour';
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Task notification check started');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role to access all tasks
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    
    // Get all incomplete tasks with due dates and notification settings
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('completed', false)
      .not('due_date', 'is', null)
      .not('notification_settings', 'eq', '{}')
      .not('organization_id', 'is', null); // Only org tasks for now (they go to Slack channels)
    
    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      throw tasksError;
    }

    console.log(`Found ${tasks?.length || 0} tasks with notifications enabled`);

    let notificationsSent = 0;

    for (const task of tasks || []) {
      const dueDate = new Date(task.due_date);
      const timeUntilDue = dueDate.getTime() - now.getTime();
      
      // Skip if already past due
      if (timeUntilDue < 0) {
        continue;
      }

      const notificationSettings: string[] = task.notification_settings || [];
      const notificationsSentList: string[] = task.notifications_sent || [];
      
      // Check each notification interval
      for (const interval of notificationSettings) {
        const intervalMs = NOTIFICATION_INTERVALS[interval];
        if (!intervalMs) continue;
        
        // Create unique notification key
        const notificationKey = `${interval}_${task.due_date}`;
        
        // Skip if already sent
        if (notificationsSentList.includes(notificationKey)) {
          continue;
        }
        
        // Check if we're within the notification window (within 5 minutes of the interval)
        const notificationTime = dueDate.getTime() - intervalMs;
        const windowStart = notificationTime - 5 * 60 * 1000; // 5 min before
        const windowEnd = notificationTime + 5 * 60 * 1000; // 5 min after
        
        if (now.getTime() >= windowStart && now.getTime() <= windowEnd) {
          console.log(`Sending ${interval} notification for task: ${task.title}`);
          
          // Get Slack settings for the organization
          const slackSettings = await getSlackSettings(supabase, task.organization_id);
          
          if (!slackSettings || !slackSettings.notificationChannel) {
            console.log(`No Slack channel configured for org ${task.organization_id}`);
            continue;
          }
          
          // Build notification message
          let message = `⏰ *Task Reminder*\n\n`;
          message += `*${task.title}*\n`;
          
          if (task.description) {
            message += `${task.description}\n`;
          }
          
          message += `\n📅 Due in ${formatTimeRemaining(timeUntilDue)}`;
          message += ` (${dueDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })})`;
          
          // Mention assigned person if available
          if (task.assigned_to) {
            const contactName = await getContactName(supabase, task.assigned_to);
            const slackUserId = await getSlackUserForContact(supabase, task.assigned_to, task.organization_id);
            
            if (slackUserId) {
              message += `\n\n👤 <@${slackUserId}>`;
            } else if (contactName) {
              message += `\n\n👤 Assigned to: ${contactName}`;
            }
          }
          
          // Add priority indicator
          if (task.priority === 'high') {
            message = `🔴 ${message}`;
          } else if (task.priority === 'medium') {
            message = `🟡 ${message}`;
          }
          
          // Send the notification
          const sent = await postSlackMessage(
            slackSettings.botToken,
            slackSettings.notificationChannel,
            message
          );
          
          if (sent) {
            // Mark notification as sent
            const updatedSentList = [...notificationsSentList, notificationKey];
            await supabase
              .from('tasks')
              .update({ notifications_sent: updatedSentList })
              .eq('id', task.id);
            
            notificationsSent++;
            console.log(`Notification sent for task ${task.id}`);
          }
        }
      }
    }

    console.log(`Task notification check complete. Sent ${notificationsSent} notifications.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        tasksChecked: tasks?.length || 0,
        notificationsSent 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in task-notifications:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
