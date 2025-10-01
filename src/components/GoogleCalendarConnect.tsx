import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCw, Calendar } from "lucide-react";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";

const GoogleCalendarConnect = () => {
  const { isConnected, connectGoogleCalendar, syncFromGoogle } = useGoogleCalendar();

  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Google Calendar</h3>
            <p className="text-sm text-muted-foreground">
              {isConnected ? 'Connected' : 'Not connected'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {isConnected ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncFromGoogle.mutate()}
                disabled={syncFromGoogle.isPending}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${syncFromGoogle.isPending ? 'animate-spin' : ''}`} />
                Sync
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => connectGoogleCalendar.mutate()}
              disabled={connectGoogleCalendar.isPending}
            >
              Connect
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default GoogleCalendarConnect;