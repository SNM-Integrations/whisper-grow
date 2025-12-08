import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Building2, Mail, Trash2, UserPlus, Shield, Crown, Users } from "lucide-react";
import { useOrganization, OrgRole } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const roleIcons: Record<OrgRole, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  member: Users,
};

const roleColors: Record<OrgRole, string> = {
  owner: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  admin: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  member: "bg-muted text-muted-foreground",
};

export function OrganizationSettings() {
  const { user } = useAuth();
  const {
    currentOrg,
    members,
    invitations,
    userRole,
    isAdmin,
    isOwner,
    inviteMember,
    cancelInvitation,
    updateMemberRole,
    removeMember,
  } = useOrganization();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("member");
  const [inviting, setInviting] = useState(false);

  if (!currentOrg) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Organization Selected</h3>
        <p className="text-muted-foreground">
          Switch to an organization to manage its settings.
        </p>
      </div>
    );
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    setInviting(true);
    const success = await inviteMember(inviteEmail.trim(), inviteRole);
    setInviting(false);

    if (success) {
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteRole("member");
    } else {
      toast.error("Failed to send invitation");
    }
  };

  const handleCancelInvitation = async (id: string) => {
    const success = await cancelInvitation(id);
    if (success) {
      toast.success("Invitation cancelled");
    } else {
      toast.error("Failed to cancel invitation");
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: OrgRole) => {
    const success = await updateMemberRole(memberId, newRole);
    if (success) {
      toast.success("Role updated");
    } else {
      toast.error("Failed to update role");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const success = await removeMember(memberId);
    if (success) {
      toast.success("Member removed");
    } else {
      toast.error("Failed to remove member");
    }
  };

  return (
    <div className="space-y-6">
      {/* Organization Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {currentOrg.name}
          </CardTitle>
          <CardDescription>
            Organization settings and member management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={roleColors[userRole || "member"]}>
              {userRole === "owner" && <Crown className="h-3 w-3 mr-1" />}
              {userRole === "admin" && <Shield className="h-3 w-3 mr-1" />}
              {userRole === "member" && <Users className="h-3 w-3 mr-1" />}
              {userRole || "Member"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Your role in this organization
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Invite Members */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite Members
            </CardTitle>
            <CardDescription>
              Send invitations to join this organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Email address"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                />
              </div>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OrgRole)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  {isOwner && <SelectItem value="owner">Owner</SelectItem>}
                </SelectContent>
              </Select>
              <Button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting}>
                {inviting ? "Sending..." : "Invite"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Invitations */}
      {isAdmin && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Pending Invitations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={roleColors[inv.role]}>
                        {inv.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCancelInvitation(inv.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Members
          </CardTitle>
          <CardDescription>
            {members.length} member{members.length !== 1 ? "s" : ""} in this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const RoleIcon = roleIcons[member.role];
                const isCurrentUser = member.user_id === user?.id;
                const canEdit = isAdmin && !isCurrentUser && (isOwner || member.role !== "owner");

                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <span className="font-medium">
                        {isCurrentUser ? "You" : member.user_id.slice(0, 8)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {canEdit ? (
                        <Select
                          value={member.role}
                          onValueChange={(v) => handleUpdateRole(member.id, v as OrgRole)}
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            {isOwner && <SelectItem value="owner">Owner</SelectItem>}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={roleColors[member.role]}>
                          <RoleIcon className="h-3 w-3 mr-1" />
                          {member.role}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(member.created_at).toLocaleDateString()}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        {canEdit && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Member</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove this member from the organization?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
