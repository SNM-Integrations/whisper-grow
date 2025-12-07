import { useState } from "react";
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

const mockDeals: Deal[] = [
  {
    id: "1",
    title: "Enterprise License",
    company: "Acme Corp",
    value: 50000,
    stage: "negotiation",
    probability: 80,
    closeDate: "Dec 15",
    contact: "Sarah Johnson",
  },
  {
    id: "2",
    title: "Annual Subscription",
    company: "TechStart",
    value: 12000,
    stage: "proposal",
    probability: 60,
    closeDate: "Dec 20",
    contact: "Michael Chen",
  },
  {
    id: "3",
    title: "Pilot Program",
    company: "Global Inc",
    value: 5000,
    stage: "qualified",
    probability: 40,
    closeDate: "Jan 5",
    contact: "Emily Davis",
  },
  {
    id: "4",
    title: "Team License",
    company: "Startup Co",
    value: 8000,
    stage: "lead",
    probability: 20,
    closeDate: "Jan 10",
    contact: "James Wilson",
  },
  {
    id: "5",
    title: "Premium Package",
    company: "Enterprise Ltd",
    value: 75000,
    stage: "closed",
    probability: 100,
    closeDate: "Nov 30",
    contact: "Lisa Anderson",
  },
  {
    id: "6",
    title: "Consulting Deal",
    company: "Tech Solutions",
    value: 25000,
    stage: "proposal",
    probability: 50,
    closeDate: "Dec 28",
    contact: "David Brown",
  },
];

const stages = [
  { id: "lead", label: "Lead", color: "bg-muted" },
  { id: "qualified", label: "Qualified", color: "bg-blue-500/10" },
  { id: "proposal", label: "Proposal", color: "bg-amber-500/10" },
  { id: "negotiation", label: "Negotiation", color: "bg-purple-500/10" },
  { id: "closed", label: "Closed Won", color: "bg-emerald-500/10" },
] as const;

export function DealsPipeline() {
  const [deals] = useState<Deal[]>(mockDeals);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);

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
                          <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive">
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <p className="text-sm text-muted-foreground">{deal.company}</p>

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

                    <div className="flex items-center justify-between pt-2 border-t border-border">
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
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {deal.closeDate}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <DealDialog open={dialogOpen} onOpenChange={setDialogOpen} deal={editingDeal} />
    </div>
  );
}
