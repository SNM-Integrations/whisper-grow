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
import { Lead } from "./LeadsList";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OwnerSelector } from "@/components/organization/OwnerSelector";
import { useOrganization, ResourceVisibility } from "@/hooks/useOrganization";

interface LeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
}

interface LeadFormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  status: Lead["status"];
}

export function LeadDialog({ open, onOpenChange, lead }: LeadDialogProps) {
  const { currentOrg, context } = useOrganization();
  const [isSaving, setIsSaving] = useState(false);
  const [owner, setOwner] = useState<{ visibility: ResourceVisibility; organizationId: string | null }>({
    visibility: "personal",
    organizationId: null,
  });

  const form = useForm<LeadFormData>({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company: "",
      status: "new",
    },
  });

  // Set default owner based on current context
  const getDefaultOwner = () => ({
    visibility: (context.mode === "organization" && currentOrg ? "organization" : "personal") as ResourceVisibility,
    organizationId: context.mode === "organization" && currentOrg ? currentOrg.id : null,
  });

  useEffect(() => {
    if (lead) {
      form.reset({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        status: lead.status,
      });
      setOwner({
        visibility: (lead as any).visibility || "personal",
        organizationId: (lead as any).organization_id || null,
      });
    } else {
      form.reset({
        name: "",
        email: "",
        phone: "",
        company: "",
        status: "new",
      });
      setOwner(getDefaultOwner());
    }
  }, [lead, form, open]);

  const onSubmit = async (data: LeadFormData) => {
    setIsSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setIsSaving(false);
      return;
    }

    const leadData = {
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      company: data.company || null,
      contact_type: "lead" as const,
      tags: [data.status],
      visibility: owner.visibility,
      organization_id: owner.organizationId,
    };

    if (lead) {
      const { error } = await supabase
        .from("contacts")
        .update({ ...leadData, updated_at: new Date().toISOString() })
        .eq("id", lead.id);
      
      if (error) {
        toast.error("Failed to update lead");
      } else {
        toast.success("Lead updated");
      }
    } else {
      const { error } = await supabase
        .from("contacts")
        .insert({ ...leadData, user_id: user.id });
      
      if (error) {
        toast.error("Failed to create lead");
      } else {
        toast.success("Lead created");
      }
    }

    setIsSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{lead ? "Edit Lead" : "Add Lead"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: "Name is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+1 555-0123" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Corp" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="proposal">Proposal</SelectItem>
                      <SelectItem value="won">Won</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
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
                {isSaving ? "Saving..." : lead ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
