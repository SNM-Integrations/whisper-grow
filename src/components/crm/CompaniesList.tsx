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
import {
  fetchCompanies,
  deleteCompany,
  type Company as SupabaseCompany,
} from "@/lib/supabase-api";

export interface Company {
  id: string;
  name: string;
  industry: string;
  website: string;
  employees: string;
  revenue: string;
  contacts: number;
  deals: number;
  status: "active" | "prospect" | "inactive";
}

const statusColors: Record<Company["status"], string> = {
  active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  prospect: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  inactive: "bg-muted text-muted-foreground border-border",
};

function mapCompany(c: SupabaseCompany): Company {
  // Determine status based on notes or other indicators
  let status: Company["status"] = "prospect";
  if (c.notes?.toLowerCase().includes("active")) status = "active";
  else if (c.notes?.toLowerCase().includes("inactive")) status = "inactive";

  return {
    id: c.id,
    name: c.name,
    industry: c.industry || "",
    website: c.website || "",
    employees: c.employees ? `${c.employees}` : "Unknown",
    revenue: c.revenue || "Unknown",
    contacts: 0, // Would need a join to count
    deals: 0, // Would need a join to count
    status,
  };
}

export function CompaniesList() {
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const loadCompanies = async () => {
    setIsLoading(true);
    const data = await fetchCompanies();
    setCompanies(data.map(mapCompany));
    setIsLoading(false);
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const filteredCompanies = companies.filter(
    (company) =>
      company.name.toLowerCase().includes(search.toLowerCase()) ||
      company.industry.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingCompany(null);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (await deleteCompany(id)) {
      setCompanies((prev) => prev.filter((c) => c.id !== id));
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
        Loading companies...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Company
        </Button>
      </div>

      {filteredCompanies.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          {search ? "No companies found" : "No companies yet. Add one!"}
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

                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">{company.contacts}</span>{" "}
                        contacts
                      </span>
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">{company.deals}</span>{" "}
                        deals
                      </span>
                    </div>
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
