import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ChevronLeft, 
  Plus, 
  FileText, 
  Upload, 
  File, 
  Trash2, 
  Download,
  CheckSquare,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { 
  fetchProjectDocuments, 
  createProjectDocument, 
  updateProjectDocument, 
  deleteProjectDocument,
  uploadProjectFile,
  downloadProjectFile,
  fetchProjectTasks,
  fetchProjectCalendarEvents,
  type Project,
  type ProjectDocument,
  type Task
} from "@/lib/supabase-api";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "./RichTextEditor";
import { format } from "date-fns";
import { OwnerSelector } from "@/components/organization/OwnerSelector";
import { useOrganization, type ResourceVisibility } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
  onUpdate: (project: Project) => void;
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, onBack, onUpdate }) => {
  const { currentOrg, context } = useOrganization();
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<ProjectDocument | null>(null);
  const [newDocDialogOpen, setNewDocDialogOpen] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [activeTab, setActiveTab] = useState("documents");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Task creation state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [taskOwner, setTaskOwner] = useState<{ visibility: ResourceVisibility; organizationId: string | null }>({
    visibility: "personal",
    organizationId: null,
  });

  // Event creation state
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDescription, setNewEventDescription] = useState("");
  const [newEventStartDate, setNewEventStartDate] = useState("");
  const [newEventStartTime, setNewEventStartTime] = useState("09:00");
  const [newEventEndDate, setNewEventEndDate] = useState("");
  const [newEventEndTime, setNewEventEndTime] = useState("10:00");
  const [eventOwner, setEventOwner] = useState<{ visibility: ResourceVisibility; organizationId: string | null }>({
    visibility: "personal",
    organizationId: null,
  });

  useEffect(() => {
    loadData();
  }, [project.id]);

  const loadData = async () => {
    setLoading(true);
    const [docs, projectTasks, events] = await Promise.all([
      fetchProjectDocuments(project.id),
      fetchProjectTasks(project.id),
      fetchProjectCalendarEvents(project.id)
    ]);
    setDocuments(docs);
    setTasks(projectTasks);
    setCalendarEvents(events);
    setLoading(false);
  };

  const handleCreateDocument = async () => {
    if (!newDocName.trim()) {
      toast.error("Document name is required");
      return;
    }

    const doc = await createProjectDocument(project.id, {
      name: newDocName.trim(),
      type: "document",
      content: "",
    });

    if (doc) {
      toast.success("Document created");
      loadData();
      setNewDocDialogOpen(false);
      setNewDocName("");
      setSelectedDocument(doc);
    } else {
      toast.error("Failed to create document");
    }
  };

  const handleSaveDocument = async (content: string) => {
    if (!selectedDocument) return;
    
    const updated = await updateProjectDocument(selectedDocument.id, { content });
    if (updated) {
      setSelectedDocument(updated);
      setDocuments(docs => docs.map(d => d.id === updated.id ? updated : d));
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm("Delete this document?")) return;
    
    const success = await deleteProjectDocument(docId);
    if (success) {
      toast.success("Document deleted");
      if (selectedDocument?.id === docId) {
        setSelectedDocument(null);
      }
      loadData();
    } else {
      toast.error("Failed to delete document");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const doc = await uploadProjectFile(project.id, file);
      if (doc) {
        toast.success("File uploaded");
        loadData();
      } else {
        toast.error("Failed to upload file");
      }
    } catch (error) {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDownloadFile = async (doc: ProjectDocument) => {
    if (!doc.file_path) return;
    
    try {
      const url = await downloadProjectFile(doc.file_path);
      if (url) {
        window.open(url, "_blank");
      } else {
        toast.error("Failed to get download link");
      }
    } catch {
      toast.error("Download failed");
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const resetTaskForm = () => {
    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskPriority("medium");
    setNewTaskDueDate("");
    setTaskOwner({
      visibility: context.mode === "organization" && currentOrg ? "organization" : "personal",
      organizationId: context.mode === "organization" && currentOrg ? currentOrg.id : null,
    });
  };

  const resetEventForm = () => {
    const today = new Date().toISOString().split("T")[0];
    setNewEventTitle("");
    setNewEventDescription("");
    setNewEventStartDate(today);
    setNewEventStartTime("09:00");
    setNewEventEndDate(today);
    setNewEventEndTime("10:00");
    setEventOwner({
      visibility: context.mode === "organization" && currentOrg ? "organization" : "personal",
      organizationId: context.mode === "organization" && currentOrg ? currentOrg.id : null,
    });
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) {
      toast.error("Task title is required");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    const { error } = await supabase.from("tasks").insert({
      title: newTaskTitle.trim(),
      description: newTaskDescription.trim() || null,
      priority: newTaskPriority,
      due_date: newTaskDueDate || null,
      project_id: project.id,
      user_id: user.id,
      visibility: taskOwner.visibility,
      organization_id: taskOwner.organizationId,
    });

    if (error) {
      toast.error("Failed to create task");
      return;
    }

    toast.success("Task created");
    setTaskDialogOpen(false);
    resetTaskForm();
    loadData();
  };

  const handleCreateEvent = async () => {
    if (!newEventTitle.trim()) {
      toast.error("Event title is required");
      return;
    }

    if (!newEventStartDate || !newEventEndDate) {
      toast.error("Dates are required");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    const startDateTime = new Date(`${newEventStartDate}T${newEventStartTime}`);
    const endDateTime = new Date(`${newEventEndDate}T${newEventEndTime}`);

    if (endDateTime <= startDateTime) {
      toast.error("End time must be after start time");
      return;
    }

    const { error } = await supabase.from("calendar_events").insert({
      title: newEventTitle.trim(),
      description: newEventDescription.trim() || null,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      project_id: project.id,
      user_id: user.id,
      visibility: eventOwner.visibility,
      organization_id: eventOwner.organizationId,
    });

    if (error) {
      toast.error("Failed to create event");
      return;
    }

    toast.success("Event created");
    setEventDialogOpen(false);
    resetEventForm();
    loadData();
  };

  // Document editor view
  if (selectedDocument && selectedDocument.type === "document") {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedDocument(null)} className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex-1">
            <h2 className="font-semibold">{selectedDocument.name}</h2>
            <p className="text-xs text-muted-foreground">
              Last updated {format(new Date(selectedDocument.updated_at), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <RichTextEditor 
            content={selectedDocument.content || ""} 
            onChange={handleSaveDocument}
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <div 
          className="w-3 h-3 rounded-full" 
          style={{ backgroundColor: project.color || "#3B82F6" }} 
        />
        <div className="flex-1">
          <h2 className="font-semibold">{project.name}</h2>
          {project.description && (
            <p className="text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-4 pt-2 border-b border-border">
          <TabsList>
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2">
              <CheckSquare className="h-4 w-4" />
              Tasks ({tasks.length})
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="h-4 w-4" />
              Events ({calendarEvents.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Documents Tab */}
        <TabsContent value="documents" className="flex-1 mt-0 overflow-hidden">
          <div className="p-4 flex gap-2 border-b border-border">
            <Dialog open={newDocDialogOpen} onOpenChange={setNewDocDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Document
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Document</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Document Name</Label>
                    <Input
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
                      placeholder="Enter document name"
                      onKeyDown={(e) => e.key === "Enter" && handleCreateDocument()}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setNewDocDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateDocument}>Create</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            <Button 
              size="sm" 
              variant="outline" 
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading..." : "Upload File"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {documents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No documents yet</p>
                  <p className="text-sm">Create a document or upload a file</p>
                </div>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => doc.type === "document" && setSelectedDocument(doc)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors group",
                      doc.type === "document" && "cursor-pointer"
                    )}
                  >
                    {doc.type === "document" ? (
                      <FileText className="h-5 w-5 text-blue-500" />
                    ) : (
                      <File className="h-5 w-5 text-muted-foreground" />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.type === "file" && doc.file_size && (
                          <span>{formatFileSize(doc.file_size)} • </span>
                        )}
                        {format(new Date(doc.updated_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {doc.type === "file" && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadFile(doc);
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDocument(doc.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="flex-1 mt-0 overflow-hidden">
          <div className="p-4 border-b border-border">
            <Dialog open={taskDialogOpen} onOpenChange={(open) => {
              setTaskDialogOpen(open);
              if (open) resetTaskForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Task</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Task title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={newTaskDescription}
                      onChange={(e) => setNewTaskDescription(e.target.value)}
                      placeholder="Optional description"
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Due Date</Label>
                      <Input
                        type="date"
                        value={newTaskDueDate}
                        onChange={(e) => setNewTaskDueDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <OwnerSelector
                    value={taskOwner}
                    onChange={setTaskOwner}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateTask}>Create</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {tasks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No tasks linked to this project</p>
                  <p className="text-sm">Create a task or link from the Tasks panel</p>
                </div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border"
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      task.completed && "bg-green-500",
                      !task.completed && task.priority === "high" && "bg-red-500",
                      !task.completed && task.priority === "medium" && "bg-yellow-500",
                      !task.completed && task.priority === "low" && "bg-blue-500"
                    )} />
                    <div className="flex-1">
                      <p className={cn("font-medium", task.completed && "line-through text-muted-foreground")}>
                        {task.title}
                      </p>
                      {task.due_date && (
                        <p className="text-xs text-muted-foreground">
                          Due {format(new Date(task.due_date), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Calendar Events Tab */}
        <TabsContent value="calendar" className="flex-1 mt-0 overflow-hidden">
          <div className="p-4 border-b border-border">
            <Dialog open={eventDialogOpen} onOpenChange={(open) => {
              setEventDialogOpen(open);
              if (open) resetEventForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Event
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Event</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={newEventTitle}
                      onChange={(e) => setNewEventTitle(e.target.value)}
                      placeholder="Event title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={newEventDescription}
                      onChange={(e) => setNewEventDescription(e.target.value)}
                      placeholder="Optional description"
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={newEventStartDate}
                        onChange={(e) => setNewEventStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        value={newEventStartTime}
                        onChange={(e) => setNewEventStartTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={newEventEndDate}
                        onChange={(e) => setNewEventEndDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        value={newEventEndTime}
                        onChange={(e) => setNewEventEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <OwnerSelector
                    value={eventOwner}
                    onChange={setEventOwner}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setEventDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateEvent}>Create</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {calendarEvents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No events linked to this project</p>
                  <p className="text-sm">Create an event or link from the Calendar</p>
                </div>
              ) : (
                calendarEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border"
                  >
                    <Calendar className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.start_time), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};
