import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  google_event_id: string | null;
  google_calendar_id: string | null;
  is_synced: boolean;
  created_at: string;
  updated_at: string;
}

export const useGoogleCalendar = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      return data as CalendarEvent[];
    },
  });

  const { data: isConnected = false } = useQuery({
    queryKey: ['google-calendar-connected'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('google_auth_tokens')
        .select('id')
        .single();
      
      return !error && !!data;
    },
  });

  const connectGoogleCalendar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth');
      
      if (error) throw error;
      if (data.authUrl) {
        window.open(data.authUrl, '_blank');
      }
      return data;
    },
    onSuccess: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['google-calendar-connected'] });
        toast({ title: "Check the popup to complete Google Calendar connection" });
      }, 1000);
    },
    onError: (error) => {
      toast({ title: "Failed to connect Google Calendar", description: error.message, variant: "destructive" });
    },
  });

  const syncFromGoogle = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-google-calendar', {
        body: { action: 'import' }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({ title: `Imported ${data.imported} events from Google Calendar` });
    },
    onError: (error) => {
      toast({ title: "Failed to sync from Google Calendar", description: error.message, variant: "destructive" });
    },
  });

  const createEvent = useMutation({
    mutationFn: async (newEvent: Partial<CalendarEvent> & { syncToGoogle?: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { syncToGoogle, ...eventData } = newEvent;

      const eventToInsert = {
        user_id: user.id,
        title: eventData.title!,
        description: eventData.description || null,
        start_time: eventData.start_time!,
        end_time: eventData.end_time!,
        location: eventData.location || null,
        google_event_id: eventData.google_event_id || null,
        google_calendar_id: eventData.google_calendar_id || null,
        is_synced: eventData.is_synced || false,
      };

      const { data, error } = await supabase
        .from('calendar_events')
        .insert([eventToInsert])
        .select()
        .single();
      
      if (error) throw error;

      // Optionally sync to Google Calendar
      if (syncToGoogle && isConnected) {
        await supabase.functions.invoke('sync-google-calendar', {
          body: { action: 'export', eventData: data }
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({ title: "Event created successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to create event", description: error.message, variant: "destructive" });
    },
  });

  const updateEvent = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CalendarEvent> }) => {
      const { data, error } = await supabase
        .from('calendar_events')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({ title: "Event updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to update event", description: error.message, variant: "destructive" });
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({ title: "Event deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to delete event", description: error.message, variant: "destructive" });
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('calendar-events-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_events'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    events,
    isLoading,
    isConnected,
    connectGoogleCalendar,
    syncFromGoogle,
    createEvent,
    updateEvent,
    deleteEvent,
  };
};