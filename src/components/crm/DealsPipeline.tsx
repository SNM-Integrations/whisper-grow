import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, DollarSign, Calendar, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DealDialog } from "./DealDialog";
import {
  fetchDeals,
  deleteDeal,
  type Deal as SupabaseDeal,
} from "@/lib/supabase-api";

export interface Deal {
  id: string;
  title: string;
  company: string;
  value: number;
  stage: "lead" | "qualified" | "proposal" | "negotiation" | "closed";
  probability: number;
  closeDate: string;
  contact: string;
}

const stages = [
  { id: "lead", label: "Lead", color: "bg-muted" },
  { id: "qualified", label: "Qualified", color: "bg-blue-500/10" },
  { id: "proposal", label: "Proposal", color: "bg-amber-500/10" },
  { id: "negotiation", label: "Negotiation", color: "bg-purple-500/10" },
  { id: "closed", label: "Closed Won", color: "bg-emerald-500/10" },
] as const;

// Map stage probability
const stageProbability: Record<string, number> = {
  lead: 20,
  qualified: 40,
  proposal: 60,
  negotiation: 80,
  closed: 100,
};

function mapDeal(d: SupabaseDeal): Deal {
  // Map Supabase stage to UI stage
  let stage: Deal["stage"] = "lead";
  const s = d.stage?.toLowerCase();
  if (s === "won" || s === "closed") stage = "closed";
  else if (s === "negotiation") stage = "negotiation";
  else if (s === "proposal") stage = "proposal";
  else if (s === "qualified") stage = "qualified";
  else stage = "lead";

  return {
    id: d.id,
    title: d.title,
    company: "", // Would need a join to get company name
    value: d.value || 0,
    stage,
    probability: stageProbability[stage] || 20,
    closeDate: d.expected_close_date
      ? new Date(d.expected_close_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "",
    contact: "", // Would need a join to get contact name
  };
}

export function DealsPipeline() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);

  const loadDeals = async () => {
    setIsLoading(true);
    const data = await fetchDeals();
    setDeals(data.map(mapDeal));
    setIsLoading(false);
  };

  useEffect(() => {
    loadDeals();
  }, []);

  const getDealsByStage = (stage: Deal["stage"]) =>
    deals.filter((deal) => deal.stage === stage);

  const getStageTotal = (stage: Deal["stage"]) =>
    getDealsByStage(stage).reduce((sum, deal) => sum + deal.value, 0);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);

  const handleEdit = (deal: Deal) => {
    setEditingDeal(deal);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingDeal(null);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (await deleteDeal(id)) {
      setDeals((prev) => prev.filter((d) => d.id !== id));
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      loadDeals();
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading deals...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Total Pipeline:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(deals.reduce((sum, deal) => sum + deal.value, 0))}
            </span>
          </div>
        </div>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Deal
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <div key={stage.id} className="min-w-[280px]">
            <div className={`rounded-t-lg px-4 py-3 ${stage.color}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">{stage.label}</h3>
                <Badge variant="secondary" className="bg-background/50">
                  {getDealsByStage(stage.id).length}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {formatCurrency(getStageTotal(stage.id))}
              </p>
            </div>

            <div className="space-y-3 p-2 bg-muted/30 rounded-b-lg min-h-[400px]">
              {getDealsByStage(stage.id).map((deal) => (
                <Card
                  key={deal.id}
                  className="cursor-pointer hover:shadow-md transition-shadow bg-card border-border"
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm font-medium line-clamp-2">
                        {deal.title}
                      </CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border">
                          <DropdownMenuItem
                            onClick={() => handleEdit(deal)}
                            className="cursor-pointer"
                          >
                            Edit Deal
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer text-destructive focus:text-destructive"
                            onClick={() => handleDelete(deal.id)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    {deal.company && (
                      <p className="text-sm text-muted-foreground">{deal.company}</p>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1 text-foreground font-medium">
                        <DollarSign className="h-3.5 w-3.5" />
                        {formatCurrency(deal.value)}
                      </div>
                      <Badge
                        variant="outline"
                        className="text-xs bg-primary/10 text-primary border-primary/20"
                      >
                        {deal.probability}%
                      </Badge>
                    </div>

                    {(deal.contact || deal.closeDate) && (
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        {deal.contact && (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[10px] bg-muted">
                                {deal.contact
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                              {deal.contact}
                            </span>
                          </div>
                        )}
                        {deal.closeDate && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {deal.closeDate}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <DealDialog open={dialogOpen} onOpenChange={handleDialogClose} deal={editingDeal} />
    </div>
  );
}
