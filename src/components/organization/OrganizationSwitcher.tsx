import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ChevronDown, Plus, User } from "lucide-react";
import { useOrganization, Organization } from "@/hooks/useOrganization";
import { toast } from "sonner";

export function OrganizationSwitcher() {
  const {
    organizations,
    currentOrg,
    context,
    createOrganization,
    switchToOrganization,
    switchToPersonal,
  } = useOrganization();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newOrgName.trim()) return;
    
    setCreating(true);
    const org = await createOrganization(newOrgName.trim());
    setCreating(false);

    if (org) {
      toast.success(`Organization "${org.name}" created!`);
      setShowCreateDialog(false);
      setNewOrgName("");
      switchToOrganization(org);
    } else {
      toast.error("Failed to create organization");
    }
  };

  const handleSelect = (org: Organization | null) => {
    if (org) {
      switchToOrganization(org);
    } else {
      switchToPersonal();
    }
  };

  const displayName = context.mode === "personal" 
    ? "Personal" 
    : currentOrg?.name || "Organization";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 h-9">
            {context.mode === "personal" ? (
              <User className="h-4 w-4" />
            ) : (
              <Building2 className="h-4 w-4" />
            )}
            <span className="max-w-[150px] truncate">{displayName}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Switch Context</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            onClick={() => handleSelect(null)}
            className="gap-2"
          >
            <User className="h-4 w-4" />
            Personal
            {context.mode === "personal" && (
              <span className="ml-auto text-xs text-muted-foreground">✓</span>
            )}
          </DropdownMenuItem>

          {organizations.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Organizations
              </DropdownMenuLabel>
              {organizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => handleSelect(org)}
                  className="gap-2"
                >
                  <Building2 className="h-4 w-4" />
                  <span className="truncate">{org.name}</span>
                  {currentOrg?.id === org.id && context.mode === "organization" && (
                    <span className="ml-auto text-xs text-muted-foreground">✓</span>
                  )}
                </DropdownMenuItem>
              ))}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              Create a new organization to collaborate with your team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                placeholder="e.g., SNM Integrations"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newOrgName.trim() || creating}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
