import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type OrgRole = "owner" | "admin" | "member";
export type ResourceVisibility = "personal" | "organization";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
  email?: string;
}

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: OrgRole;
  invited_by: string;
  expires_at: string;
  created_at: string;
}

export interface OrganizationContext {
  mode: "personal" | "organization";
  organizationId: string | null;
}

const CONTEXT_KEY = "sb_org_context";

export function useOrganization() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [userRole, setUserRole] = useState<OrgRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [context, setContextState] = useState<OrganizationContext>(() => {
    const stored = localStorage.getItem(CONTEXT_KEY);
    return stored ? JSON.parse(stored) : { mode: "personal", organizationId: null };
  });

  const setContext = useCallback((ctx: OrganizationContext) => {
    setContextState(ctx);
    localStorage.setItem(CONTEXT_KEY, JSON.stringify(ctx));
  }, []);

  const fetchOrganizations = useCallback(async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .order("name");

    if (!error && data) {
      setOrganizations(data);
      
      // If context has an org, set it as current
      if (context.organizationId) {
        const org = data.find(o => o.id === context.organizationId);
        setCurrentOrg(org || null);
      }
    }
    setLoading(false);
  }, [user, context.organizationId]);

  const fetchMembers = useCallback(async (orgId: string) => {
    const { data } = await supabase
      .from("organization_members")
      .select("*")
      .eq("organization_id", orgId);
    
    if (data) {
      setMembers(data);
      const myMembership = data.find(m => m.user_id === user?.id);
      setUserRole(myMembership?.role || null);
    }
  }, [user?.id]);

  const fetchInvitations = useCallback(async (orgId: string) => {
    const { data } = await supabase
      .from("organization_invitations")
      .select("*")
      .eq("organization_id", orgId);
    
    if (data) {
      setInvitations(data);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchOrganizations();
    }
  }, [user, fetchOrganizations]);

  useEffect(() => {
    if (currentOrg) {
      fetchMembers(currentOrg.id);
      fetchInvitations(currentOrg.id);
    }
  }, [currentOrg, fetchMembers, fetchInvitations]);

  const createOrganization = async (name: string): Promise<Organization | null> => {
    if (!user) return null;
    
    const { data, error } = await supabase.rpc('create_organization', { org_name: name });
    
    if (error || !data) {
      console.error("Error creating organization:", error);
      return null;
    }

    await fetchOrganizations();
    return organizations.find(o => o.id === data) || null;
  };

  const switchToOrganization = (org: Organization | null) => {
    if (org) {
      setCurrentOrg(org);
      setContext({ mode: "organization", organizationId: org.id });
    } else {
      setCurrentOrg(null);
      setContext({ mode: "personal", organizationId: null });
    }
  };

  const switchToPersonal = () => {
    setCurrentOrg(null);
    setContext({ mode: "personal", organizationId: null });
  };

  const inviteMember = async (email: string, role: OrgRole = "member"): Promise<boolean> => {
    if (!currentOrg || !user) return false;

    const { error } = await supabase
      .from("organization_invitations")
      .insert({
        organization_id: currentOrg.id,
        email,
        role,
        invited_by: user.id
      });

    if (error) {
      console.error("Error inviting member:", error);
      return false;
    }

    await fetchInvitations(currentOrg.id);
    return true;
  };

  const cancelInvitation = async (invitationId: string): Promise<boolean> => {
    const { error } = await supabase
      .from("organization_invitations")
      .delete()
      .eq("id", invitationId);

    if (error) {
      console.error("Error canceling invitation:", error);
      return false;
    }

    if (currentOrg) {
      await fetchInvitations(currentOrg.id);
    }
    return true;
  };

  const updateMemberRole = async (memberId: string, role: OrgRole): Promise<boolean> => {
    const { error } = await supabase
      .from("organization_members")
      .update({ role })
      .eq("id", memberId);

    if (error) {
      console.error("Error updating member role:", error);
      return false;
    }

    if (currentOrg) {
      await fetchMembers(currentOrg.id);
    }
    return true;
  };

  const removeMember = async (memberId: string): Promise<boolean> => {
    const { error } = await supabase
      .from("organization_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      console.error("Error removing member:", error);
      return false;
    }

    if (currentOrg) {
      await fetchMembers(currentOrg.id);
    }
    return true;
  };

  const isAdmin = userRole === "owner" || userRole === "admin";
  const isOwner = userRole === "owner";

  return {
    organizations,
    currentOrg,
    context,
    members,
    invitations,
    userRole,
    isAdmin,
    isOwner,
    loading,
    createOrganization,
    switchToOrganization,
    switchToPersonal,
    inviteMember,
    cancelInvitation,
    updateMemberRole,
    removeMember,
    refreshOrganizations: fetchOrganizations,
  };
}
