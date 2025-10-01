import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import EventForm from "./EventForm";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";

const Calendar = () => {
  const { events, isLoading, deleteEvent } = useGoogleCalendar();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [selectedEventDate, setSelectedEventDate] = useState<Date | undefined>();

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDate = (date: Date) => {
    return events.filter(event => 
      isSameDay(new Date(event.start_time), date)
    );
  };

  const handleDateClick = (date: Date) => {
    setSelectedEventDate(date);
    setEventFormOpen(true);
  };

  const previousMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={previousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold min-w-[200px] text-center">
            {format(selectedDate, 'MMMM yyyy')}
          </h2>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button onClick={() => setEventFormOpen(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          New Event
        </Button>
      </div>

      <Card className="p-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading calendar...</div>
        ) : (
          <CalendarUI
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            className="rounded-md border-0 w-full pointer-events-auto"
            modifiers={{
              hasEvents: daysInMonth.filter(day => getEventsForDate(day).length > 0)
            }}
            modifiersClassNames={{
              hasEvents: "bg-primary/10 font-bold"
            }}
            onDayClick={handleDateClick}
          />
        )}
      </Card>

      {/* Events for selected date */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">
          Events on {format(selectedDate, 'MMMM d, yyyy')}
        </h3>
        {getEventsForDate(selectedDate).length === 0 ? (
          <p className="text-sm text-muted-foreground">No events for this day</p>
        ) : (
          <div className="space-y-2">
            {getEventsForDate(selectedDate).map((event) => (
              <div key={event.id} className="p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">{event.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(event.start_time), 'h:mm a')} - {format(new Date(event.end_time), 'h:mm a')}
                    </p>
                    {event.location && (
                      <p className="text-sm text-muted-foreground mt-1">📍 {event.location}</p>
                    )}
                    {event.description && (
                      <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                    )}
                    {event.is_synced && (
                      <span className="text-xs text-primary">✓ Synced with Google Calendar</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteEvent.mutate(event.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <EventForm
        open={eventFormOpen}
        onOpenChange={setEventFormOpen}
        defaultDate={selectedEventDate}
      />
    </div>
  );
};

export default Calendar;