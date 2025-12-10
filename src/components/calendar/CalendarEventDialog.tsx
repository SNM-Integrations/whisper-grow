import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { OwnerSelector } from "@/components/organization/OwnerSelector";
import { useOrganization, type ResourceVisibility } from "@/hooks/useOrganization";
import { fetchProjects, type Project } from "@/lib/supabase-api";
import { supabase } from "@/integrations/supabase/client";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  location?: string | null;
  project_id?: string | null;
  visibility: "personal" | "organization";
  organization_id: string | null;
}

interface CalendarEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  onSave: () => void;
  defaultDate?: Date;
  defaultTime?: string;
  defaultProjectId?: string;
}

export function CalendarEventDialog({
  open,
  onOpenChange,
  event,
  onSave,
  defaultDate,
  defaultTime,
  defaultProjectId,
}: CalendarEventDialogProps) {
  const { currentOrg, context } = useOrganization();
  const [projects, setProjects] = useState<Project[]>([]);
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("10:00");
  const [visibility, setVisibility] = useState<ResourceVisibility>("personal");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProjects().then(setProjects);
  }, []);

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || "");
      setLocation(event.location || "");
      const start = new Date(event.start_time);
      const end = new Date(event.end_time);
      setStartDate(start.toISOString().split("T")[0]);
      setStartTime(start.toTimeString().slice(0, 5));
      setEndDate(end.toISOString().split("T")[0]);
      setEndTime(end.toTimeString().slice(0, 5));
      setVisibility(event.visibility);
      setOrganizationId(event.organization_id);
      setProjectId(event.project_id);
    } else {
      resetForm();
    }
  }, [event, open]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setLocation("");
    const date = defaultDate || new Date();
    const dateStr = date.toISOString().split("T")[0];
    setStartDate(dateStr);
    setEndDate(dateStr);
    
    // Use defaultTime if provided, otherwise default to 9am-10am
    const startTimeValue = defaultTime || "09:00";
    const [startHour] = startTimeValue.split(":");
    const endHour = (parseInt(startHour) + 1).toString().padStart(2, "0");
    setStartTime(startTimeValue);
    setEndTime(`${endHour}:00`);
    
    setVisibility(context.mode === "organization" && currentOrg ? "organization" : "personal");
    setOrganizationId(context.mode === "organization" && currentOrg ? currentOrg.id : null);
    setProjectId(defaultProjectId || null);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (!startDate || !endDate) {
      toast.error("Dates are required");
      return;
    }

    setSaving(true);

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);

    if (endDateTime <= startDateTime) {
      toast.error("End time must be after start time");
      setSaving(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setSaving(false);
      return;
    }

    const eventData = {
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      visibility,
      organization_id: organizationId,
      project_id: projectId,
      user_id: user.id,
    };

    let error;
    if (event) {
      const { error: updateError } = await supabase
        .from("calendar_events")
        .update(eventData)
        .eq("id", event.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("calendar_events")
        .insert(eventData);
      error = insertError;
    }

    setSaving(false);

    if (error) {
      console.error("Error saving event:", error);
      toast.error("Failed to save event");
      return;
    }

    toast.success(event ? "Event updated" : "Event created");
    onOpenChange(false);
    onSave();
  };

  const handleDelete = async () => {
    if (!event) return;
    
    if (!confirm("Delete this event?")) return;

    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", event.id);

    if (error) {
      toast.error("Failed to delete event");
      return;
    }

    toast.success("Event deleted");
    onOpenChange(false);
    onSave();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? "Edit Event" : "New Event"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Optional location"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Owner Selector */}
          <OwnerSelector
            value={{ visibility, organizationId }}
            onChange={({ visibility: v, organizationId: orgId }) => {
              setVisibility(v);
              setOrganizationId(orgId);
            }}
          />

          {/* Project Selector */}
          <div className="space-y-2">
            <Label>Project</Label>
            <Select
              value={projectId || "none"}
              onValueChange={(v) => setProjectId(v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">No project</span>
                </SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: project.color || "#3B82F6" }}
                      />
                      {project.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-between pt-4">
            {event && (
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : event ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}