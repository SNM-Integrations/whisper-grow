import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, FolderOpen, Building2, MoreVertical, Trash2, FileText, Upload, ChevronLeft } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { 
  fetchProjects, 
  createProject, 
  updateProject, 
  deleteProject,
  fetchCompanies,
  type Project,
  type Company
} from "@/lib/supabase-api";
import { cn } from "@/lib/utils";
import { OwnerSelector } from "@/components/organization/OwnerSelector";
import { useOrganization, ResourceVisibility } from "@/hooks/useOrganization";
import { ProjectDetail } from "./ProjectDetail";

const PROJECT_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
];

export const ProjectsPanel: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [status, setStatus] = useState("active");
  const [owner, setOwner] = useState<{ visibility: ResourceVisibility; organizationId: string | null }>({
    visibility: "personal",
    organizationId: null,
  });
  
  const { organizations, context } = useOrganization();

  useEffect(() => {
    loadData();
  }, [context]);

  const loadData = async () => {
    setLoading(true);
    const [projectsData, companiesData] = await Promise.all([
      fetchProjects(context),
      fetchCompanies(context)
    ]);
    setProjects(projectsData);
    setCompanies(companiesData);
    setLoading(false);
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setCompanyId(null);
    setColor(PROJECT_COLORS[0]);
    setStatus("active");
    setOwner({ visibility: "personal", organizationId: null });
    setEditingProject(null);
  };

  const openEditDialog = (project: Project) => {
    setEditingProject(project);
    setName(project.name);
    setDescription(project.description || "");
    setCompanyId(project.company_id);
    setColor(project.color || PROJECT_COLORS[0]);
    setStatus(project.status);
    setOwner({
      visibility: project.visibility,
      organizationId: project.organization_id,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Project name is required");
      return;
    }

    const projectData = {
      name: name.trim(),
      description: description.trim() || null,
      company_id: companyId,
      color,
      status,
      visibility: owner.visibility,
      organization_id: owner.organizationId,
      assigned_to: null,
    };

    if (editingProject) {
      const updated = await updateProject(editingProject.id, projectData);
      if (updated) {
        toast.success("Project updated");
        loadData();
        // Update selected project if we were viewing it
        if (selectedProject?.id === editingProject.id) {
          setSelectedProject(updated);
        }
      } else {
        toast.error("Failed to update project");
      }
    } else {
      const created = await createProject(projectData);
      if (created) {
        toast.success("Project created");
        loadData();
      } else {
        toast.error("Failed to create project");
      }
    }
    
    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this project? All documents will be deleted.")) return;
    
    const success = await deleteProject(id);
    if (success) {
      toast.success("Project deleted");
      loadData();
      if (selectedProject?.id === id) {
        setSelectedProject(null);
      }
    } else {
      toast.error("Failed to delete project");
    }
  };

  const getCompanyName = (companyId: string | null) => {
    if (!companyId) return null;
    return companies.find(c => c.id === companyId)?.name || null;
  };

  // Show project detail view
  if (selectedProject) {
    return (
      <ProjectDetail 
        project={selectedProject}
        onBack={() => setSelectedProject(null)}
        onUpdate={(updated) => {
          setSelectedProject(updated);
          loadData();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold">Projects</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingProject ? "Edit Project" : "New Project"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Project name"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Project description"
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Company (optional)</Label>
                <Select value={companyId || "none"} onValueChange={(v) => setCompanyId(v === "none" ? null : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No company</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all",
                        color === c && "ring-2 ring-offset-2 ring-offset-background ring-primary"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <OwnerSelector value={owner} onChange={setOwner} />
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  {editingProject ? "Save Changes" : "Create Project"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Projects Grid */}
      <ScrollArea className="flex-1">
        <div className="p-4 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No projects yet</p>
              <p className="text-sm">Create your first project to get started</p>
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                onClick={() => setSelectedProject(project)}
                className="group relative bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors"
              >
                {/* Color bar */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-lg"
                  style={{ backgroundColor: project.color || PROJECT_COLORS[0] }}
                />
                
                <div className="pt-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{project.name}</h3>
                      {project.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {project.description}
                        </p>
                      )}
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(project);
                        }}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(project.id);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                    {getCompanyName(project.company_id) && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {getCompanyName(project.company_id)}
                      </span>
                    )}
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs",
                      project.status === "active" && "bg-green-500/10 text-green-500",
                      project.status === "on-hold" && "bg-yellow-500/10 text-yellow-500",
                      project.status === "completed" && "bg-blue-500/10 text-blue-500",
                      project.status === "archived" && "bg-muted text-muted-foreground"
                    )}>
                      {project.status}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ProjectsPanel;
