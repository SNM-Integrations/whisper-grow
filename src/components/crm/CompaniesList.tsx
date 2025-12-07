import { useState } from "react";
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

const mockCompanies: Company[] = [
  {
    id: "1",
    name: "Acme Corp",
    industry: "Technology",
    website: "acme.com",
    employees: "500-1000",
    revenue: "$50M-$100M",
    contacts: 5,
    deals: 2,
    status: "active",
  },
  {
    id: "2",
    name: "TechStart",
    industry: "SaaS",
    website: "techstart.io",
    employees: "50-100",
    revenue: "$5M-$10M",
    contacts: 3,
    deals: 1,
    status: "prospect",
  },
  {
    id: "3",
    name: "Global Inc",
    industry: "Manufacturing",
    website: "globalinc.com",
    employees: "1000-5000",
    revenue: "$100M-$500M",
    contacts: 8,
    deals: 3,
    status: "active",
  },
  {
    id: "4",
    name: "Startup Co",
    industry: "Fintech",
    website: "startup.co",
    employees: "10-50",
    revenue: "$1M-$5M",
    contacts: 2,
    deals: 1,
    status: "prospect",
  },
  {
    id: "5",
    name: "Enterprise Ltd",
    industry: "Consulting",
    website: "enterprise.com",
    employees: "100-500",
    revenue: "$10M-$50M",
    contacts: 4,
    deals: 0,
    status: "inactive",
  },
  {
    id: "6",
    name: "Tech Solutions",
    industry: "IT Services",
    website: "techsolutions.io",
    employees: "200-500",
    revenue: "$20M-$50M",
    contacts: 6,
    deals: 2,
    status: "active",
  },
];

const statusColors: Record<Company["status"], string> = {
  active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  prospect: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  inactive: "bg-muted text-muted-foreground border-border",
};

export function CompaniesList() {
  const [search, setSearch] = useState("");
  const [companies] = useState<Company[]>(mockCompanies);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

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
                    <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-3">
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

      <CompanyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        company={editingCompany}
      />
    </div>
  );
}
