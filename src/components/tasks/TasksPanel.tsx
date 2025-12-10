import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Calendar, Building2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
  type Task,
} from "@/lib/supabase-api";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { VisibilitySelector } from "@/components/organization/VisibilitySelector";
import { useOrganization, type ResourceVisibility } from "@/hooks/useOrganization";

export function TasksPanel() {
  const { currentOrg, context } = useOrganization();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState("");
  const [visibility, setVisibility] = useState<ResourceVisibility>("personal");
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    const data = await fetchTasks();
    setTasks(data);
    setLoading(false);
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setVisibility(context.mode === "organization" && currentOrg ? "organization" : "personal");
    setOrganizationId(context.mode === "organization" && currentOrg ? currentOrg.id : null);
    setEditingTask(null);
  };

  const handleOpenDialog = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority);
      setDueDate(task.due_date ? task.due_date.split("T")[0] : "");
      setVisibility(task.visibility);
      setOrganizationId(task.organization_id);
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    const taskData = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      completed: editingTask?.completed || false,
      visibility,
      organization_id: organizationId,
      project_id: null,
    };

    if (editingTask) {
      const updated = await updateTask(editingTask.id, taskData);
      if (updated) {
        toast.success("Task updated");
        loadTasks();
      } else {
        toast.error("Failed to update task");
      }
    } else {
      const created = await createTask(taskData);
      if (created) {
        toast.success("Task created");
        loadTasks();
      } else {
        toast.error("Failed to create task");
      }
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleToggleComplete = async (task: Task) => {
    const updated = await updateTask(task.id, { completed: !task.completed });
    if (updated) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t))
      );
    }
  };

  const handleDelete = async (id: string) => {
    const success = await deleteTask(id);
    if (success) {
      toast.success("Task deleted");
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } else {
      toast.error("Failed to delete task");
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === "active") return !task.completed;
    if (filter === "completed") return task.completed;
    return true;
  });

  const priorityColors = {
    low: "bg-green-500/20 text-green-400 border-green-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    high: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}
          </span>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTask ? "Edit Task" : "New Task"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Task title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
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
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
              
              {/* Visibility Selector */}
              {context.mode === "organization" && currentOrg && (
                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <VisibilitySelector
                    value={visibility}
                    onChange={(v, orgId) => {
                      setVisibility(v);
                      setOrganizationId(orgId);
                    }}
                  />
                </div>
              )}
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  {editingTask ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tasks List */}
      <ScrollArea className="flex-1">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-muted-foreground mb-4">
              {filter === "completed"
                ? "No completed tasks yet"
                : filter === "active"
                ? "No active tasks"
                : "No tasks yet"}
            </div>
            {filter === "all" && (
              <Button variant="outline" onClick={() => handleOpenDialog()}>
                Create your first task
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-lg border bg-card transition-colors hover:bg-accent/50 cursor-pointer",
                  task.completed && "opacity-60"
                )}
                onClick={() => handleOpenDialog(task)}
              >
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={() => handleToggleComplete(task)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={cn(
                        "font-medium",
                        task.completed && "line-through text-muted-foreground"
                      )}
                    >
                      {task.title}
                    </span>
                    <Badge variant="outline" className={priorityColors[task.priority]}>
                      {task.priority}
                    </Badge>
                    {task.visibility === "organization" && (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 gap-1">
                        <Building2 className="h-3 w-3" />
                        Shared
                      </Badge>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  {task.due_date && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(task.due_date), "MMM d, yyyy")}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(task.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
