import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreHorizontal,
  Building2,
  Users,
  DollarSign,
  Globe,
  Edit,
  Trash2,
} from "lucide-react";
import { ClientDialog } from "./ClientDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganization } from "@/hooks/useOrganization";

export interface Client {
  id: string;
  name: string;
  industry: string;
  website: string;
  employees: string;
  revenue: string;
  status: "active" | "paused" | "churned";
  assigned_to: string | null;
}

const statusColors: Record<Client["status"], string> = {
  active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  paused: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  churned: "bg-destructive/10 text-destructive border-destructive/20",
};

export function ClientsList() {
  const { context } = useOrganization();
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const loadClients = async () => {
    setIsLoading(true);
    let query = supabase
      .from("companies")
      .select("*")
      .eq("company_type", "client")
      .order("name", { ascending: true });

    // Filter by context
    if (context.mode === "personal") {
      query = query.eq("visibility", "personal");
    } else if (context.mode === "organization" && context.organizationId) {
      query = query.eq("visibility", "organization").eq("organization_id", context.organizationId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching clients:", error);
      setClients([]);
    } else {
      setClients(
        (data || []).map((c) => {
          let status: Client["status"] = "active";
          if (c.notes?.toLowerCase().includes("churned")) status = "churned";
          else if (c.notes?.toLowerCase().includes("paused")) status = "paused";

          return {
            id: c.id,
            name: c.name,
            industry: c.industry || "",
            website: c.website || "",
            employees: c.employees ? `${c.employees}` : "Unknown",
            revenue: c.revenue || "Unknown",
            status,
            assigned_to: c.assigned_to,
          };
        })
      );
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadClients();
  }, [context]);

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(search.toLowerCase()) ||
      client.industry.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingClient(null);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete client");
    } else {
      setClients((prev) => prev.filter((c) => c.id !== id));
      toast.success("Client deleted");
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      loadClients();
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading clients...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
      </div>

      {filteredClients.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          {search ? "No clients found" : "No clients yet. Add one!"}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => (
            <Card
              key={client.id}
              className="hover:shadow-md transition-shadow bg-card border-border cursor-pointer"
              onClick={() => handleEdit(client)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{client.name}</h3>
                      <p className="text-sm text-muted-foreground">{client.industry}</p>
                    </div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border-border">
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer"
                          onClick={() => handleEdit(client)}
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                          onClick={() => handleDelete(client.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="space-y-3">
                  {client.website && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Globe className="h-4 w-4" />
                      <a
                        href={`https://${client.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors"
                      >
                        {client.website}
                      </a>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {client.employees}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      {client.revenue}
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-3 border-t border-border">
                    <Badge variant="outline" className={statusColors[client.status]}>
                      {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ClientDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        client={editingClient}
      />
    </div>
  );
}
