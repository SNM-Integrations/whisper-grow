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
import { CompanyDialog } from "./CompanyDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganization } from "@/hooks/useOrganization";

// Company Lead (prospective company)
export interface CompanyLead {
  id: string;
  name: string;
  industry: string;
  website: string;
  employees: string;
  revenue: string;
  status: "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";
  assigned_to: string | null;
}

const statusColors: Record<CompanyLead["status"], string> = {
  new: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  contacted: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  qualified: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  proposal: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  won: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  lost: "bg-destructive/10 text-destructive border-destructive/20",
};

export function CompaniesList() {
  const { context } = useOrganization();
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<CompanyLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyLead | null>(null);

  const loadCompanies = async () => {
    setIsLoading(true);
    let query = supabase
      .from("companies")
      .select("*")
      .eq("company_type", "lead")
      .order("name", { ascending: true });

    // Filter by context
    if (context.mode === "personal") {
      query = query.eq("visibility", "personal");
    } else if (context.mode === "organization" && context.organizationId) {
      query = query.eq("visibility", "organization").eq("organization_id", context.organizationId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching company leads:", error);
      setCompanies([]);
    } else {
      setCompanies(
        (data || []).map((c) => {
          let status: CompanyLead["status"] = "new";
          if (c.notes?.toLowerCase().includes("won")) status = "won";
          else if (c.notes?.toLowerCase().includes("lost")) status = "lost";
          else if (c.notes?.toLowerCase().includes("proposal")) status = "proposal";
          else if (c.notes?.toLowerCase().includes("qualified")) status = "qualified";
          else if (c.notes?.toLowerCase().includes("contacted")) status = "contacted";

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
    loadCompanies();
  }, [context]);

  const filteredCompanies = companies.filter(
    (company) =>
      company.name.toLowerCase().includes(search.toLowerCase()) ||
      company.industry.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (company: CompanyLead) => {
    setEditingCompany(company);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingCompany(null);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete company lead");
    } else {
      setCompanies((prev) => prev.filter((c) => c.id !== id));
      toast.success("Company lead deleted");
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      loadCompanies();
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading company leads...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search company leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Company Lead
        </Button>
      </div>

      {filteredCompanies.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          {search ? "No company leads found" : "No company leads yet. Add one!"}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCompanies.map((company) => (
            <Card
              key={company.id}
              className="hover:shadow-md transition-shadow bg-card border-border"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{company.name}</h3>
                      <p className="text-sm text-muted-foreground">{company.industry}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover border-border">
                      <DropdownMenuItem
                        className="gap-2 cursor-pointer"
                        onClick={() => handleEdit(company)}
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                        onClick={() => handleDelete(company.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-3">
                  {company.website && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Globe className="h-4 w-4" />
                      <a
                        href={`https://${company.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors"
                      >
                        {company.website}
                      </a>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {company.employees}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      {company.revenue}
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-3 border-t border-border">
                    <Badge variant="outline" className={statusColors[company.status]}>
                      {company.status.charAt(0).toUpperCase() + company.status.slice(1)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CompanyDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        company={editingCompany}
      />
    </div>
  );
}
