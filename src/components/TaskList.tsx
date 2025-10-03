import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import TaskDialog from "./TaskDialog";
import { Badge } from "@/components/ui/badge";

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  priority: string;
  completed: boolean;
  user_id: string;
  category_id?: string;
}

interface TaskListProps {
  refreshTrigger?: number;
}

const TaskList = ({ refreshTrigger }: TaskListProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTasks();
  }, [refreshTrigger]);

  const fetchTasks = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("due_date", { ascending: true, nullsFirst: false });

    if (error) {
      toast({
        title: "Error fetching tasks",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setTasks(data || []);
  };

  const handleToggleComplete = async (task: Task) => {
    const { error } = await supabase
      .from("tasks")
      .update({ completed: !task.completed })
      .eq("id", task.id);

    if (error) {
      toast({
        title: "Error updating task",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    fetchTasks();
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsDialogOpen(true);
  };

  const handleNewTask = () => {
    setSelectedTask(null);
    setIsDialogOpen(true);
  };

  const handleTaskSaved = () => {
    fetchTasks();
    setIsDialogOpen(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "default";
    }
  };

  const groupTasks = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return {
      overdue: tasks.filter(t => !t.completed && t.due_date && new Date(t.due_date) < today),
      today: tasks.filter(t => !t.completed && t.due_date && new Date(t.due_date) >= today && new Date(t.due_date) < tomorrow),
      upcoming: tasks.filter(t => !t.completed && (!t.due_date || new Date(t.due_date) >= tomorrow)),
      completed: tasks.filter(t => t.completed),
    };
  };

  const grouped = groupTasks();

  const TaskItem = ({ task }: { task: Task }) => (
    <Card
      className="p-4 cursor-pointer hover:bg-accent transition-colors"
      onClick={() => handleTaskClick(task)}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={task.completed}
          onCheckedChange={() => handleToggleComplete(task)}
          onClick={(e) => e.stopPropagation()}
          className="mt-1"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`font-semibold ${task.completed ? "line-through text-muted-foreground" : ""}`}>
              {task.title}
            </h4>
            <Badge variant={getPriorityColor(task.priority)}>
              {task.priority}
            </Badge>
          </div>
          {task.description && (
            <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
          )}
          {task.due_date && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(task.due_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </div>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Tasks</h2>
        <Button onClick={handleNewTask} className="gap-2">
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </div>

      {grouped.overdue.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <h3 className="text-lg font-semibold text-destructive">Overdue</h3>
          </div>
          <div className="space-y-2">
            {grouped.overdue.map(task => <TaskItem key={task.id} task={task} />)}
          </div>
        </div>
      )}

      {grouped.today.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Today</h3>
          <div className="space-y-2">
            {grouped.today.map(task => <TaskItem key={task.id} task={task} />)}
          </div>
        </div>
      )}

      {grouped.upcoming.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Upcoming</h3>
          <div className="space-y-2">
            {grouped.upcoming.map(task => <TaskItem key={task.id} task={task} />)}
          </div>
        </div>
      )}

      {grouped.completed.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-muted-foreground">Completed</h3>
          <div className="space-y-2">
            {grouped.completed.map(task => <TaskItem key={task.id} task={task} />)}
          </div>
        </div>
      )}

      {tasks.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No tasks yet. Create your first task to get started!</p>
        </Card>
      )}

      <TaskDialog
        task={selectedTask}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSaved={handleTaskSaved}
      />
    </div>
  );
};

export default TaskList;
