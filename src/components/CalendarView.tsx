import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CalendarEventDialog from "./CalendarEventDialog";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  user_id: string;
  is_synced?: boolean;
  google_event_id?: string;
}

interface CalendarViewProps {
  refreshTrigger?: number;
}

const CalendarView = ({ refreshTrigger }: CalendarViewProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [selectedDate, refreshTrigger]);

  // Realtime subscription for calendar events
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
        (payload) => {
          console.log('Calendar event changed:', payload);
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate]);

  // Check Google Calendar connection
  useEffect(() => {
    let mounted = true;
    supabase.functions.invoke('check-google-connection')
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.log('Google connection check failed:', error);
          setGoogleConnected(false);
        } else {
          setGoogleConnected(!!data?.connected);
        }
      })
      .catch(() => setGoogleConnected(false));
    return () => { mounted = false; };
  }, []);

  const fetchEvents = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Compute UTC boundaries for the selected date
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const day = selectedDate.getDate();
    
    const startOfDayUtc = new Date(Date.UTC(year, month, day, 0, 0, 0, 0)).toISOString();
    const endOfDayUtc = new Date(Date.UTC(year, month, day, 23, 59, 59, 999)).toISOString();

    console.log('Fetching events for UTC range:', { startOfDayUtc, endOfDayUtc });

    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("user_id", user.id)
      .gte("start_time", startOfDayUtc)
      .lte("start_time", endOfDayUtc)
      .order("start_time");

    if (error) {
      toast({
        title: "Error fetching events",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    console.log('Fetched events:', data);
    setEvents(data || []);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDialogOpen(true);
  };

  const handleNewEvent = () => {
    setSelectedEvent(null);
    setIsDialogOpen(true);
  };

  const handleEventSaved = () => {
    fetchEvents();
    setIsDialogOpen(false);
  };

  const handleConnectGoogle = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-google-oauth-url');
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: 'Connection failed',
          description: 'Could not get Google OAuth URL',
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      toast({
        title: 'Connection failed',
        description: e.message || 'Error connecting to Google',
        variant: 'destructive',
      });
    }
  };

  const handlePullFromGoogle = async () => {
    setIsSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('sync-from-google-calendar', { body: {} as any });
      if (error) throw error;
      toast({ title: 'Synced from Google', description: 'Your events have been imported.' });
      fetchEvents();
    } catch (e: any) {
      toast({ title: 'Sync failed', description: e.message || 'Could not sync from Google', variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePushUnsynced = async () => {
    setIsSyncing(true);
    try {
      const unsynced = events.filter(e => !e.is_synced);
      let ok = 0, fail = 0;
      for (const ev of unsynced) {
        const { error } = await supabase.functions.invoke('sync-to-google-calendar', { body: { eventId: ev.id } });
        if (error) fail++; else ok++;
      }
      toast({
        title: 'Push complete',
        description: `${ok} synced, ${fail} failed.`,
        variant: fail ? 'destructive' : undefined,
      });
      fetchEvents();
    } catch (e: any) {
      toast({ title: 'Push failed', description: e.message || 'Could not sync to Google', variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Calendar</h2>
        <div className="flex gap-2">
          <Button onClick={handleNewEvent} className="gap-2">
            <Plus className="h-4 w-4" />
            New Event
          </Button>
          {googleConnected === false && (
            <Button variant="outline" onClick={handleConnectGoogle}>
              Connect Google Calendar
            </Button>
          )}
          {googleConnected && (
            <>
              <Button variant="outline" onClick={handlePullFromGoogle} disabled={isSyncing}>
                {isSyncing ? 'Syncing…' : 'Pull from Google'}
              </Button>
              <Button
                variant="outline"
                onClick={handlePushUnsynced}
                disabled={isSyncing || events.every(e => e.is_synced)}
              >
                Push unsynced
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            className="rounded-md border"
          />
        </Card>

        <Card className="lg:col-span-2 p-6">
          <h3 className="text-lg font-semibold mb-4">
            Events for {selectedDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </h3>
          
          <div className="space-y-3">
            {events.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No events scheduled for this day
              </p>
            ) : (
              events.map((event) => (
                <Card
                  key={event.id}
                  className="p-4 cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => handleEventClick(event)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{event.title}</h4>
                        {event.is_synced && (
                          <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                            Google
                          </span>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {event.description}
                        </p>
                      )}
                      {event.location && (
                        <p className="text-sm text-muted-foreground mt-1">
                          📍 {event.location}
                        </p>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(event.start_time).toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </Card>
      </div>

      <CalendarEventDialog
        event={selectedEvent}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSaved={handleEventSaved}
        defaultDate={selectedDate}
      />
    </div>
  );
};

export default CalendarView;
