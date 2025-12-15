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
import { Textarea } from "@/components/ui/textarea";
import { Lead } from "./LeadsList";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OwnerSelector } from "@/components/organization/OwnerSelector";
import { useOrganization, ResourceVisibility } from "@/hooks/useOrganization";
import { Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

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
  // SevenTime fields
  personal_number: string;
  address: string;
  zip_code: string;
  city: string;
  job_description: string;
  rot_rut_info: string;
  estimated_hours: string;
  start_date: string;
  end_date: string;
}

export function LeadDialog({ open, onOpenChange, lead }: LeadDialogProps) {
  const { currentOrg, context } = useOrganization();
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
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
      personal_number: "",
      address: "",
      zip_code: "",
      city: "",
      job_description: "",
      rot_rut_info: "",
      estimated_hours: "",
      start_date: "",
      end_date: "",
    },
  });

  const getDefaultOwner = () => ({
    visibility: (context.mode === "organization" && currentOrg ? "organization" : "personal") as ResourceVisibility,
    organizationId: context.mode === "organization" && currentOrg ? currentOrg.id : null,
  });

  const isSynced = !!(lead as any)?.seventime_customer_id && !!(lead as any)?.seventime_workorder_id;

  useEffect(() => {
    if (lead) {
      const leadData = lead as any;
      form.reset({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        status: lead.status,
        personal_number: leadData.personal_number || "",
        address: leadData.address || "",
        zip_code: leadData.zip_code || "",
        city: leadData.city || "",
        job_description: leadData.job_description || "",
        rot_rut_info: leadData.rot_rut_info || "",
        estimated_hours: leadData.estimated_hours?.toString() || "",
        start_date: leadData.start_date || "",
        end_date: leadData.end_date || "",
      });
      setOwner({
        visibility: leadData.visibility || "personal",
        organizationId: leadData.organization_id || null,
      });
    } else {
      form.reset({
        name: "",
        email: "",
        phone: "",
        company: "",
        status: "new",
        personal_number: "",
        address: "",
        zip_code: "",
        city: "",
        job_description: "",
        rot_rut_info: "",
        estimated_hours: "",
        start_date: "",
        end_date: "",
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
      // SevenTime fields
      personal_number: data.personal_number || null,
      address: data.address || null,
      zip_code: data.zip_code || null,
      city: data.city || null,
      job_description: data.job_description || null,
      rot_rut_info: data.rot_rut_info || null,
      estimated_hours: data.estimated_hours ? parseFloat(data.estimated_hours) : null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
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

  const handleCreateWorkOrder = async () => {
    if (!lead) return;

    // Validate required fields
    const formValues = form.getValues();
    if (!formValues.name || !formValues.personal_number) {
      toast.error("Name and Personal Number are required for work order");
      return;
    }

    // Save form first
    await onSubmit(formValues);

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('seventime-sync', {
        body: {
          contactId: lead.id,
          organizationId: owner.organizationId,
        },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Work order created in SevenTime!");
        onOpenChange(false);
      }
    } catch (error) {
      console.error('SevenTime sync error:', error);
      toast.error("Failed to create work order in SevenTime");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {lead ? "Edit Lead" : "Add Lead"}
            {isSynced && (
              <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Synced to SevenTime
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    rules={{ required: "Name is required" }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="personal_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Personal Number (Personnummer) *</FormLabel>
                        <FormControl>
                          <Input placeholder="YYYYMMDD-XXXX" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                          <Input placeholder="+46 70 123 4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
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
              </div>

              <Separator />

              {/* Address */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Address</h3>
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Storgatan 1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="zip_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zip Code</FormLabel>
                        <FormControl>
                          <Input placeholder="123 45" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="Stockholm" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Work Order Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Work Order Details</h3>
                <FormField
                  control={form.control}
                  name="job_description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe the work to be done..." 
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rot_rut_info"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ROT/RUT Information</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Tax deduction details..." 
                          className="min-h-[60px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="estimated_hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Hours</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.5" placeholder="8" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="end_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              <OwnerSelector
                value={owner}
                onChange={setOwner}
              />

              <div className="flex justify-between gap-3 pt-4">
                <div>
                  {lead && !isSynced && (
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={handleCreateWorkOrder}
                      disabled={isSyncing || isSaving}
                      className="bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Creating Work Order...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Create Work Order
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving || isSyncing}>
                    {isSaving ? "Saving..." : lead ? "Update" : "Create"}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
