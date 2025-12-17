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
import { Contact } from "./ContactsList";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OwnerSelector } from "@/components/organization/OwnerSelector";
import { useOrganization, ResourceVisibility } from "@/hooks/useOrganization";
import { Building2 } from "lucide-react";

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
}

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  company_id: string;
  relationship: Contact["relationship"];
}

interface CompanyOption {
  id: string;
  name: string;
}

export function ContactDialog({ open, onOpenChange, contact }: ContactDialogProps) {
  const { currentOrg, context } = useOrganization();
  const [isSaving, setIsSaving] = useState(false);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [owner, setOwner] = useState<{ visibility: ResourceVisibility; organizationId: string | null }>({
    visibility: "personal",
    organizationId: null,
  });

  const form = useForm<ContactFormData>({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company_id: "",
      relationship: "network",
    },
  });

  // Load companies for dropdown
  useEffect(() => {
    const loadCompanies = async () => {
      let query = supabase
        .from("companies")
        .select("id, name")
        .order("name", { ascending: true });

      if (context.mode === "personal") {
        query = query.eq("visibility", "personal");
      } else if (context.mode === "organization" && context.organizationId) {
        query = query.eq("visibility", "organization").eq("organization_id", context.organizationId);
      }

      const { data } = await query;
      setCompanies(data || []);
    };

    if (open) {
      loadCompanies();
    }
  }, [open, context]);

  // Set default owner based on current context
  const getDefaultOwner = () => ({
    visibility: (context.mode === "organization" && currentOrg ? "organization" : "personal") as ResourceVisibility,
    organizationId: context.mode === "organization" && currentOrg ? currentOrg.id : null,
  });

  useEffect(() => {
    if (contact) {
      form.reset({
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        company_id: contact.company_id || "",
        relationship: contact.relationship,
      });
      setOwner({
        visibility: (contact as any).visibility || "personal",
        organizationId: (contact as any).organization_id || null,
      });
    } else {
      form.reset({
        name: "",
        email: "",
        phone: "",
        company_id: "",
        relationship: "network",
      });
      setOwner(getDefaultOwner());
    }
  }, [contact, form, open]);

  const onSubmit = async (data: ContactFormData) => {
    setIsSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setIsSaving(false);
      return;
    }

    // Get company name if company_id is selected
    const selectedCompany = companies.find(c => c.id === data.company_id);

    const contactData = {
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      company_id: data.company_id || null,
      company: selectedCompany?.name || null,
      contact_type: "contact" as const,
      tags: [data.relationship],
      visibility: owner.visibility,
      organization_id: owner.organizationId,
    };

    if (contact) {
      const { error } = await supabase
        .from("contacts")
        .update({ ...contactData, updated_at: new Date().toISOString() })
        .eq("id", contact.id);
      
      if (error) {
        toast.error("Failed to update contact");
      } else {
        toast.success("Contact updated");
      }
    } else {
      const { error } = await supabase
        .from("contacts")
        .insert({ ...contactData, user_id: user.id });
      
      if (error) {
        toast.error("Failed to create contact");
      } else {
        toast.success("Contact created");
      }
    }

    setIsSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit Contact" : "Add Contact"}</DialogTitle>
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
              name="company_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select a company">
                          {field.value && (
                            <span className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              {companies.find(c => c.id === field.value)?.name}
                            </span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="">No company</SelectItem>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          <span className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            {company.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="relationship"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relationship</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="friend">Friend</SelectItem>
                      <SelectItem value="colleague">Colleague</SelectItem>
                      <SelectItem value="partner">Partner</SelectItem>
                      <SelectItem value="network">Network</SelectItem>
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
                {isSaving ? "Saving..." : contact ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
