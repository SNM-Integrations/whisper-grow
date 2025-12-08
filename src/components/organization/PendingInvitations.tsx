import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PendingInvitation {
  id: string;
  organization_id: string;
  organization_name: string;
  role: "owner" | "admin" | "member";
  invited_by: string;
  expires_at: string;
  created_at: string;
}

export function PendingInvitations() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchPendingInvitations = async () => {
    if (!user?.email) return;

    try {
      // Fetch invitations for user's email with organization names
      const { data, error } = await supabase
        .from("organization_invitations")
        .select(`
          id,
          organization_id,
          role,
          invited_by,
          expires_at,
          created_at,
          organizations!inner(name)
        `)
        .eq("email", user.email)
        .gt("expires_at", new Date().toISOString());

      if (error) throw error;

      const formatted = (data || []).map((inv: any) => ({
        id: inv.id,
        organization_id: inv.organization_id,
        organization_name: inv.organizations.name,
        role: inv.role,
        invited_by: inv.invited_by,
        expires_at: inv.expires_at,
        created_at: inv.created_at,
      }));

      setInvitations(formatted);
    } catch (error) {
      console.error("Error fetching invitations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingInvitations();
  }, [user?.email]);

  const acceptInvitation = async (invitation: PendingInvitation) => {
    if (!user) return;
    setProcessing(invitation.id);

    try {
      // Add user to organization members
      const { error: memberError } = await supabase
        .from("organization_members")
        .insert({
          organization_id: invitation.organization_id,
          user_id: user.id,
          role: invitation.role,
        });

      if (memberError) throw memberError;

      // Delete the invitation
      const { error: deleteError } = await supabase
        .from("organization_invitations")
        .delete()
        .eq("id", invitation.id);

      if (deleteError) throw deleteError;

      toast.success(`Joined ${invitation.organization_name}!`);
      setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      toast.error(error.message || "Failed to accept invitation");
    } finally {
      setProcessing(null);
    }
  };

  const declineInvitation = async (invitation: PendingInvitation) => {
    setProcessing(invitation.id);

    try {
      const { error } = await supabase
        .from("organization_invitations")
        .delete()
        .eq("id", invitation.id);

      if (error) throw error;

      toast.success("Invitation declined");
      setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
    } catch (error: any) {
      console.error("Error declining invitation:", error);
      toast.error(error.message || "Failed to decline invitation");
    } finally {
      setProcessing(null);
    }
  };

  const roleColors: Record<string, string> = {
    owner: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    admin: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    member: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  };

  if (loading) {
    return null;
  }

  if (invitations.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Pending Invitations
        </CardTitle>
        <CardDescription>
          You have been invited to join the following organizations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {invitations.map((invitation) => (
          <div
            key={invitation.id}
            className="flex items-center justify-between p-3 rounded-lg border bg-card"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{invitation.organization_name}</p>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={roleColors[invitation.role]}
                  >
                    {invitation.role}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Expires {new Date(invitation.expires_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => declineInvitation(invitation)}
                disabled={processing === invitation.id}
              >
                {processing === invitation.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                onClick={() => acceptInvitation(invitation)}
                disabled={processing === invitation.id}
              >
                {processing === invitation.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Accept
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
