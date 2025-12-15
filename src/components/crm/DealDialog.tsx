import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Deal } from "./DealsPipeline";
import { createDeal, updateDeal } from "@/lib/supabase-api";
import { OwnerSelector } from "@/components/organization/OwnerSelector";
import { useOrganization, ResourceVisibility } from "@/hooks/useOrganization";

interface DealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal | null;
}

interface DealFormData {
  title: string;
  value: number;
  stage: Deal["stage"];
  closeDate: string;
}

export function DealDialog({ open, onOpenChange, deal }: DealDialogProps) {
  const { currentOrg, context } = useOrganization();
  const [isSaving, setIsSaving] = useState(false);
  const [owner, setOwner] = useState<{ visibility: ResourceVisibility; organizationId: string | null }>({
    visibility: "personal",
    organizationId: null,
  });

  const form = useForm<DealFormData>({
    defaultValues: {
      title: "",
      value: 0,
      stage: "lead",
      closeDate: "",
    },
  });

  // Set default owner based on current context
  const getDefaultOwner = () => ({
    visibility: (context.mode === "organization" && currentOrg ? "organization" : "personal") as ResourceVisibility,
    organizationId: context.mode === "organization" && currentOrg ? currentOrg.id : null,
  });

  useEffect(() => {
    if (deal) {
      form.reset({
        title: deal.title,
        value: deal.value,
        stage: deal.stage,
        closeDate: deal.closeDate,
      });
      setOwner({
        visibility: (deal as any).visibility || "personal",
        organizationId: (deal as any).organization_id || null,
      });
    } else {
      form.reset({
        title: "",
        value: 0,
        stage: "lead",
        closeDate: "",
      });
      setOwner(getDefaultOwner());
    }
  }, [deal, form, open]);

  const onSubmit = async (data: DealFormData) => {
    setIsSaving(true);

    // Map UI stage to Supabase stage
    let supabaseStage = data.stage;
    if (data.stage === "closed") supabaseStage = "won" as any;

    const dealData = {
      title: data.title,
      value: data.value,
      stage: supabaseStage,
      contact_id: null,
      company_id: null,
      expected_close_date: data.closeDate || null,
      notes: null,
      visibility: owner.visibility,
      organization_id: owner.organizationId,
    };

    if (deal) {
      await updateDeal(deal.id, dealData);
    } else {
      await createDeal(dealData);
    }

    setIsSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{deal ? "Edit Deal" : "Add Deal"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              rules={{ required: "Title is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deal Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enterprise License" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Value ($)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="50000"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="stage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stage</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select stage" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="proposal">Proposal</SelectItem>
                      <SelectItem value="negotiation">Negotiation</SelectItem>
                      <SelectItem value="closed">Closed Won</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="closeDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected Close Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <OwnerSelector
              value={owner}
              onChange={setOwner}
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : deal ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
