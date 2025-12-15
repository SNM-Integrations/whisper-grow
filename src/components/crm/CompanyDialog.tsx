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
import { CompanyLead } from "./CompaniesList";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OwnerSelector } from "@/components/organization/OwnerSelector";
import { useOrganization, ResourceVisibility } from "@/hooks/useOrganization";

interface CompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: CompanyLead | null;
}

interface CompanyFormData {
  name: string;
  industry: string;
  website: string;
  employees: string;
  revenue: string;
  status: CompanyLead["status"];
}

export function CompanyDialog({ open, onOpenChange, company }: CompanyDialogProps) {
  const { currentOrg, context } = useOrganization();
  const [isSaving, setIsSaving] = useState(false);
  const [owner, setOwner] = useState<{ visibility: ResourceVisibility; organizationId: string | null }>({
    visibility: "personal",
    organizationId: null,
  });

  const form = useForm<CompanyFormData>({
    defaultValues: {
      name: "",
      industry: "",
      website: "",
      employees: "",
      revenue: "",
      status: "new",
    },
  });

  // Set default owner based on current context
  const getDefaultOwner = () => ({
    visibility: (context.mode === "organization" && currentOrg ? "organization" : "personal") as ResourceVisibility,
    organizationId: context.mode === "organization" && currentOrg ? currentOrg.id : null,
  });

  useEffect(() => {
    if (company) {
      form.reset({
        name: company.name,
        industry: company.industry,
        website: company.website,
        employees: company.employees,
        revenue: company.revenue,
        status: company.status,
      });
      setOwner({
        visibility: (company as any).visibility || "personal",
        organizationId: (company as any).organization_id || null,
      });
    } else {
      form.reset({
        name: "",
        industry: "",
        website: "",
        employees: "",
        revenue: "",
        status: "new",
      });
      setOwner(getDefaultOwner());
    }
  }, [company, form, open]);

  const onSubmit = async (data: CompanyFormData) => {
    setIsSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setIsSaving(false);
      return;
    }

    let employeeCount: number | null = null;
    if (data.employees) {
      const match = data.employees.match(/\d+/);
      if (match) employeeCount = parseInt(match[0], 10);
    }

    const companyData = {
      name: data.name,
      industry: data.industry || null,
      website: data.website || null,
      employees: employeeCount,
      revenue: data.revenue || null,
      company_type: "lead" as const,
      notes: data.status,
      visibility: owner.visibility,
      organization_id: owner.organizationId,
    };

    if (company) {
      const { error } = await supabase
        .from("companies")
        .update({ ...companyData, updated_at: new Date().toISOString() })
        .eq("id", company.id);
      
      if (error) {
        toast.error("Failed to update company lead");
      } else {
        toast.success("Company lead updated");
      }
    } else {
      const { error } = await supabase
        .from("companies")
        .insert({ ...companyData, user_id: user.id });
      
      if (error) {
        toast.error("Failed to create company lead");
      } else {
        toast.success("Company lead created");
      }
    }

    setIsSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{company ? "Edit Company Lead" : "Add Company Lead"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: "Company name is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Corp" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry</FormLabel>
                  <FormControl>
                    <Input placeholder="Technology" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input placeholder="acme.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="employees"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employees</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="1-10">1-10</SelectItem>
                        <SelectItem value="10-50">10-50</SelectItem>
                        <SelectItem value="50-100">50-100</SelectItem>
                        <SelectItem value="100-500">100-500</SelectItem>
                        <SelectItem value="500-1000">500-1000</SelectItem>
                        <SelectItem value="1000-5000">1000-5000</SelectItem>
                        <SelectItem value="5000+">5000+</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="revenue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Revenue</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select range" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="<$1M">{"<$1M"}</SelectItem>
                        <SelectItem value="$1M-$5M">$1M-$5M</SelectItem>
                        <SelectItem value="$5M-$10M">$5M-$10M</SelectItem>
                        <SelectItem value="$10M-$50M">$10M-$50M</SelectItem>
                        <SelectItem value="$50M-$100M">$50M-$100M</SelectItem>
                        <SelectItem value="$100M-$500M">$100M-$500M</SelectItem>
                        <SelectItem value="$500M+">$500M+</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
                {isSaving ? "Saving..." : company ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
