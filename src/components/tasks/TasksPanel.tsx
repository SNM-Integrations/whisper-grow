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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Calendar, Building2, FolderOpen, User, ChevronDown, ChevronRight, CheckCircle2, Bell } from "lucide-react";
import { toast } from "sonner";
import {
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
  fetchProjects,
  fetchContacts,
  type Task,
  type Project,
  type Contact,
} from "@/lib/supabase-api";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { OwnerSelector } from "@/components/organization/OwnerSelector";
import { useOrganization, type ResourceVisibility } from "@/hooks/useOrganization";

const priorityOrder = { high: 0, medium: 1, low: 2 };

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // First sort by priority
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    
    // Then sort by due date (tasks with due dates first, earlier dates first)
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    
    return 0;
  });
}

interface TaskItemProps {
  task: Task;
  projects: Project[];
  contacts: Contact[];
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onAddSubtask: (parentId: string) => void;
  subTasks: Task[];
  level?: number;
}

function TaskItem({ 
  task, 
  projects, 
  contacts, 
  onToggleComplete, 
  onEdit, 
  onDelete,
  onAddSubtask,
  subTasks,
  level = 0
}: TaskItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasSubTasks = subTasks.length > 0;

  const priorityColors = {
    low: "bg-green-500/20 text-green-400 border-green-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    high: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <div className={cn("space-y-1", level > 0 && "ml-6 border-l-2 border-muted pl-3")}>
      <div
        className={cn(
          "flex items-start gap-3 p-3 rounded-lg border bg-card transition-colors hover:bg-accent/50 cursor-pointer",
          task.completed && "opacity-60"
        )}
        onClick={() => onEdit(task)}
      >
        {hasSubTasks ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 p-0 mt-0.5"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        ) : (
          <div className="w-6" />
        )}
        <Checkbox
          checked={task.completed}
          onCheckedChange={() => onToggleComplete(task)}
          onClick={(e) => e.stopPropagation()}
          className="mt-1"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
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
            {task.assigned_to && (
              <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20 gap-1">
                <User className="h-3 w-3" />
                {contacts.find(c => c.id === task.assigned_to)?.name || "Assigned"}
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
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onAddSubtask(task.id);
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {hasSubTasks && isExpanded && (
        <div className="space-y-1">
          {subTasks.map((subTask) => (
            <TaskItem
              key={subTask.id}
              task={subTask}
              projects={projects}
              contacts={contacts}
              onToggleComplete={onToggleComplete}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddSubtask={onAddSubtask}
              subTasks={[]} // Sub-tasks don't have their own sub-tasks for now
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TasksPanel() {
  const { currentOrg, context } = useOrganization();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(["no-project"]));
  const [showFinished, setShowFinished] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState("");
  const [visibility, setVisibility] = useState<ResourceVisibility>("personal");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [parentTaskId, setParentTaskId] = useState<string | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [context]);

  const loadData = async () => {
    setLoading(true);
    const [tasksData, projectsData, contactsData] = await Promise.all([
      fetchTasks(context),
      fetchProjects(context),
      fetchContacts(context)
    ]);
    setTasks(tasksData);
    setProjects(projectsData);
    setContacts(contactsData.filter(c => c.contact_type === "contact"));
    setLoading(false);
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setVisibility(context.mode === "organization" && currentOrg ? "organization" : "personal");
    setOrganizationId(context.mode === "organization" && currentOrg ? currentOrg.id : null);
    setProjectId(null);
    setAssignedTo(null);
    setParentTaskId(null);
    setNotificationSettings([]);
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
      setProjectId(task.project_id);
      setAssignedTo(task.assigned_to);
      setParentTaskId(task.parent_task_id);
      setNotificationSettings(task.notification_settings || []);
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleAddSubtask = (parentId: string) => {
    const parentTask = tasks.find(t => t.id === parentId);
    resetForm();
    setParentTaskId(parentId);
    if (parentTask) {
      setProjectId(parentTask.project_id);
      setVisibility(parentTask.visibility);
      setOrganizationId(parentTask.organization_id);
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
      project_id: projectId,
      assigned_to: assignedTo,
      parent_task_id: parentTaskId,
      notification_settings: notificationSettings,
      notifications_sent: editingTask?.notifications_sent || [],
    };

    if (editingTask) {
      const updated = await updateTask(editingTask.id, taskData);
      if (updated) {
        toast.success("Task updated");
        loadData();
      } else {
        toast.error("Failed to update task");
      }
    } else {
      const created = await createTask(taskData);
      if (created) {
        toast.success(parentTaskId ? "Sub-task created" : "Task created");
        loadData();
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
      setTasks((prev) => prev.filter((t) => t.id !== id && t.parent_task_id !== id));
    } else {
      toast.error("Failed to delete task");
    }
  };

  const toggleProjectExpand = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  // Separate active and completed tasks (only top-level)
  const topLevelTasks = tasks.filter(t => !t.parent_task_id);
  const activeTasks = sortTasks(topLevelTasks.filter(t => !t.completed));
  const completedTasks = sortTasks(topLevelTasks.filter(t => t.completed));

  // Group active tasks by project
  const tasksByProject = new Map<string | null, Task[]>();
  activeTasks.forEach(task => {
    const key = task.project_id;
    if (!tasksByProject.has(key)) {
      tasksByProject.set(key, []);
    }
    tasksByProject.get(key)!.push(task);
  });

  // Get sub-tasks for a given parent
  const getSubTasks = (parentId: string) => 
    sortTasks(tasks.filter(t => t.parent_task_id === parentId));

  // Projects with tasks
  const projectsWithTasks = projects.filter(p => tasksByProject.has(p.id));
  const noProjectTasks = tasksByProject.get(null) || [];

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
          <span className="text-sm text-muted-foreground">
            {activeTasks.length} active task{activeTasks.length !== 1 ? "s" : ""}
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
              <DialogTitle>
                {editingTask ? "Edit Task" : parentTaskId ? "New Sub-task" : "New Task"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {parentTaskId && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                  Sub-task of: {tasks.find(t => t.id === parentTaskId)?.title}
                </div>
              )}
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
              
              {/* Owner Selector */}
              <OwnerSelector
                value={{ visibility, organizationId }}
                onChange={({ visibility: v, organizationId: orgId }) => {
                  setVisibility(v);
                  setOrganizationId(orgId);
                }}
              />

              {/* Project Selector - hidden for sub-tasks */}
              {!parentTaskId && (
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
                              style={{ backgroundColor: project.color || '#3B82F6' }} 
                            />
                            {project.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Responsible Party Selector */}
              <div className="space-y-2">
                <Label>Responsible Party</Label>
                <Select 
                  value={assignedTo || "none"} 
                  onValueChange={(v) => setAssignedTo(v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No one assigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">No one assigned</span>
                    </SelectItem>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {contact.name}
                          {contact.company && (
                            <span className="text-muted-foreground text-xs">({contact.company})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notification Settings - only show when due date is set */}
              {dueDate && visibility === "organization" && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Slack Notifications
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "1h", label: "1 hour" },
                      { value: "6h", label: "6 hours" },
                      { value: "12h", label: "12 hours" },
                      { value: "24h", label: "24 hours" },
                      { value: "48h", label: "48 hours" },
                      { value: "1w", label: "1 week" },
                    ].map((option) => {
                      const isSelected = notificationSettings.includes(option.value);
                      return (
                        <Button
                          key={option.value}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            if (isSelected) {
                              setNotificationSettings(prev => prev.filter(v => v !== option.value));
                            } else {
                              setNotificationSettings(prev => [...prev, option.value]);
                            }
                          }}
                          className="h-7 text-xs"
                        >
                          {option.label}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Send reminder to Slack channel before due date
                  </p>
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
        {activeTasks.length === 0 && completedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-muted-foreground mb-4">No tasks yet</div>
            <Button variant="outline" onClick={() => handleOpenDialog()}>
              Create your first task
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* No Project Tasks */}
            {noProjectTasks.length > 0 && (
              <Collapsible 
                open={expandedProjects.has("no-project")} 
                onOpenChange={() => toggleProjectExpand("no-project")}
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-accent/50 rounded-lg transition-colors">
                  {expandedProjects.has("no-project") ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium text-muted-foreground">No Project</span>
                  <Badge variant="secondary" className="ml-auto">{noProjectTasks.length}</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {noProjectTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      projects={projects}
                      contacts={contacts}
                      onToggleComplete={handleToggleComplete}
                      onEdit={handleOpenDialog}
                      onDelete={handleDelete}
                      onAddSubtask={handleAddSubtask}
                      subTasks={getSubTasks(task.id)}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Project Folders */}
            {projectsWithTasks.map((project) => {
              const projectTasks = tasksByProject.get(project.id) || [];
              return (
                <Collapsible 
                  key={project.id}
                  open={expandedProjects.has(project.id)} 
                  onOpenChange={() => toggleProjectExpand(project.id)}
                >
                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-accent/50 rounded-lg transition-colors">
                    {expandedProjects.has(project.id) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <FolderOpen className="h-4 w-4" style={{ color: project.color || '#3B82F6' }} />
                    <span className="font-medium">{project.name}</span>
                    <Badge variant="secondary" className="ml-auto">{projectTasks.length}</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-2 ml-2">
                    {projectTasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        projects={projects}
                        contacts={contacts}
                        onToggleComplete={handleToggleComplete}
                        onEdit={handleOpenDialog}
                        onDelete={handleDelete}
                        onAddSubtask={handleAddSubtask}
                        subTasks={getSubTasks(task.id)}
                      />
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}

            {/* Finished Tasks */}
            {completedTasks.length > 0 && (
              <Collapsible 
                open={showFinished} 
                onOpenChange={setShowFinished}
                className="mt-6"
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-accent/50 rounded-lg transition-colors border-t pt-4">
                  {showFinished ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-muted-foreground">Finished Tasks</span>
                  <Badge variant="secondary" className="ml-auto">{completedTasks.length}</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {completedTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      projects={projects}
                      contacts={contacts}
                      onToggleComplete={handleToggleComplete}
                      onEdit={handleOpenDialog}
                      onDelete={handleDelete}
                      onAddSubtask={handleAddSubtask}
                      subTasks={getSubTasks(task.id)}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
