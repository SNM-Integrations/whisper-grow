import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  // Get auth from URL params
  const url = new URL(req.url);
  const authHeader = url.searchParams.get('auth') || '';
  
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: authHeader },
      },
    }
  );

  let userId: string | null = null;
  let sessionId: string | null = null;
  const chunks: Blob[] = [];

  socket.onopen = async () => {
    console.log('[Stream] WebSocket opened');
    
    // Verify auth
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      socket.close(1008, 'Unauthorized');
      return;
    }
    userId = user.id;
    console.log('[Stream] User authenticated:', userId);
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      
      if (data.type === 'start') {
        sessionId = data.sessionId;
        chunks.length = 0;
        console.log('[Stream] Recording session started:', sessionId);
        socket.send(JSON.stringify({ type: 'started', sessionId }));
      } 
      else if (data.type === 'chunk' && sessionId) {
        // Decode base64 audio chunk
        const binaryString = atob(data.audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        chunks.push(new Blob([bytes], { type: 'audio/webm' }));
        console.log(`[Stream] Chunk ${chunks.length} received, size: ${bytes.length}`);
        
        socket.send(JSON.stringify({ 
          type: 'chunk_received', 
          chunkNumber: chunks.length,
          totalSize: chunks.reduce((acc, c) => acc + c.size, 0)
        }));
      }
      else if (data.type === 'stop' && sessionId && userId) {
        console.log('[Stream] Stopping recording, combining chunks...');
        
        // Combine all chunks
        const combinedBlob = new Blob(chunks, { type: 'audio/webm' });
        const arrayBuffer = await combinedBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Convert to base64 for storage
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64Audio = btoa(binary);
        
        console.log('[Stream] Combined audio size:', uint8Array.length, 'bytes');
        
        socket.send(JSON.stringify({ 
          type: 'completed',
          sessionId,
          audio: base64Audio,
          chunks: chunks.length,
          size: uint8Array.length
        }));
        
        chunks.length = 0;
        sessionId = null;
      }
    } catch (error) {
      console.error('[Stream] Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      socket.send(JSON.stringify({ type: 'error', message: errorMessage }));
    }
  };

  socket.onerror = (e) => console.error('[Stream] WebSocket error:', e);
  socket.onclose = () => console.log('[Stream] WebSocket closed');

  return response;
});
