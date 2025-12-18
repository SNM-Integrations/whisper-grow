import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Loader2, Eye, EyeOff, Check, AlertCircle, Link2, Unlink, RefreshCw } from "lucide-react";

interface IntegrationConfig {
  google?: {
    client_id?: string;
    client_secret?: string;
  };
  n8n?: {
    mcp_url?: string;
  };
  slack?: {
    bot_token?: string;
    signing_secret?: string;
  };
  seventime?: {
    default_user_id?: string;
    customer_responsible_id?: string;
    parttime_users?: string;
  };
}

export const IntegrationSettings = () => {
  const { user } = useAuth();
  const { currentOrg, context } = useOrganization();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  
  // Google OAuth settings
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  
  // n8n settings
  const [n8nMcpUrl, setN8nMcpUrl] = useState("");

  // Slack settings
  const [slackBotToken, setSlackBotToken] = useState("");
  const [slackSigningSecret, setSlackSigningSecret] = useState("");
  const [slackNotificationChannel, setSlackNotificationChannel] = useState("");
  const [slackUserId, setSlackUserId] = useState("");
  const [slackWorkspaceId, setSlackWorkspaceId] = useState("");
  const [slackLinked, setSlackLinked] = useState(false);

  // SevenTime settings
  const [seventimeDefaultUserId, setSeventimeDefaultUserId] = useState("");
  const [seventimeCustomerResponsibleId, setSeventimeCustomerResponsibleId] = useState("");
  const [seventimeParttimeUsers, setSeventimeParttimeUsers] = useState("");

  // Google connected accounts
  const [connectedGoogleAccounts, setConnectedGoogleAccounts] = useState<Array<{
    id: string;
    google_email: string | null;
    display_name: string | null;
    scopes: string[] | null;
    created_at: string;
  }>>([]);
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  const isOrgContext = context.mode === "organization" && currentOrg;
  const contextLabel = isOrgContext ? currentOrg.name : "Personal";

  // Track if we've already fetched for current context to prevent losing unsaved changes
  const [hasFetched, setHasFetched] = useState(false);
  const contextKey = isOrgContext && currentOrg ? currentOrg.id : "personal";

  useEffect(() => {
    if (user && !hasFetched) {
      fetchSettings();
      fetchSlackMapping();
      fetchConnectedGoogleAccounts();
      setHasFetched(true);
    }
  }, [user, hasFetched]);

  // Reset hasFetched when context changes so we fetch new data
  useEffect(() => {
    setHasFetched(false);
  }, [contextKey]);

  const fetchSettings = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch settings for current context (personal or org)
      const query = supabase
        .from("integration_settings")
        .select("*")
        .eq("user_id", user.id);

      if (isOrgContext && currentOrg) {
        query.eq("organization_id", currentOrg.id);
      } else {
        query.is("organization_id", null);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Parse settings
      data?.forEach((setting) => {
        const settingsData = setting.settings as Record<string, unknown>;
        if (setting.integration_type === "google") {
          setGoogleClientId((settingsData?.client_id as string) || "");
          setGoogleClientSecret((settingsData?.client_secret as string) || "");
        } else if (setting.integration_type === "n8n") {
          setN8nMcpUrl((settingsData?.mcp_url as string) || "");
        } else if (setting.integration_type === "slack") {
          setSlackBotToken((settingsData?.bot_token as string) || "");
          setSlackSigningSecret((settingsData?.signing_secret as string) || "");
          setSlackNotificationChannel((settingsData?.notification_channel as string) || "");
        } else if (setting.integration_type === "seventime") {
          setSeventimeDefaultUserId((settingsData?.default_user_id as string) || "");
          setSeventimeCustomerResponsibleId((settingsData?.customer_responsible_id as string) || "");
          setSeventimeParttimeUsers((settingsData?.parttime_users as string) || "");
        }
      });
    } catch (error) {
      console.error("Error fetching integration settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSlackMapping = async () => {
    if (!user) return;
    
    try {
      const query = supabase
        .from("slack_user_mappings")
        .select("*")
        .eq("user_id", user.id);

      if (isOrgContext && currentOrg) {
        query.eq("organization_id", currentOrg.id);
      } else {
        query.is("organization_id", null);
      }

      const { data } = await query.maybeSingle();

      if (data) {
        setSlackUserId(data.slack_user_id || "");
        setSlackWorkspaceId(data.slack_workspace_id || "");
        setSlackLinked(true);
      } else {
        setSlackUserId("");
        setSlackWorkspaceId("");
        setSlackLinked(false);
      }
    } catch (error) {
      console.error("Error fetching Slack mapping:", error);
    }
  };

  const saveIntegration = async (integrationType: string, settings: Record<string, unknown>) => {
    if (!user) return;
    
    setSaving(true);
    try {
      // Check if record exists
      const query = supabase
        .from("integration_settings")
        .select("id")
        .eq("user_id", user.id)
        .eq("integration_type", integrationType);

      if (isOrgContext && currentOrg) {
        query.eq("organization_id", currentOrg.id);
      } else {
        query.is("organization_id", null);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("integration_settings")
          .update({ settings: settings as unknown as Record<string, never>, updated_at: new Date().toISOString() })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("integration_settings")
          .insert([{
            user_id: user.id,
            organization_id: isOrgContext && currentOrg ? currentOrg.id : null,
            integration_type: integrationType,
            settings: settings as unknown as Record<string, never>,
          }]);

        if (error) throw error;
      }

      toast({
        title: "Settings saved",
        description: `${integrationType.charAt(0).toUpperCase() + integrationType.slice(1)} integration settings updated for ${contextLabel}.`,
      });
    } catch (error) {
      console.error("Error saving integration settings:", error);
      toast({
        title: "Error saving settings",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGoogle = () => {
    saveIntegration("google", {
      client_id: googleClientId,
      client_secret: googleClientSecret,
    });
  };

  const fetchConnectedGoogleAccounts = async () => {
    if (!user) return;
    
    try {
      const query = supabase
        .from("google_auth_tokens")
        .select("id, google_email, display_name, scopes, created_at")
        .eq("user_id", user.id);

      if (isOrgContext && currentOrg) {
        query.eq("organization_id", currentOrg.id);
      } else {
        query.is("organization_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      setConnectedGoogleAccounts(data || []);
    } catch (error) {
      console.error("Error fetching connected Google accounts:", error);
    }
  };

  const handleConnectGoogle = async () => {
    if (!user) return;
    
    setConnectingGoogle(true);
    try {
      const supabaseUrl = "https://pccvvqmrwbcdjgkyteqn.supabase.co";
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error("No session found. Please log in again.");
      }

      // Build OAuth URL with organization context
      const params = new URLSearchParams({
        action: "authorize",
      });
      if (isOrgContext && currentOrg) {
        params.append("organization_id", currentOrg.id);
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/google-oauth?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();
      
      if (data.url) {
        // Redirect to Google OAuth
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to get OAuth URL");
      }
    } catch (error) {
      console.error("Error initiating Google OAuth:", error);
      toast({
        title: "Error connecting Google",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async (tokenId: string) => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("google_auth_tokens")
        .delete()
        .eq("id", tokenId)
        .eq("user_id", user.id);

      if (error) throw error;

      setConnectedGoogleAccounts(prev => prev.filter(a => a.id !== tokenId));
      toast({
        title: "Google account disconnected",
        description: "The Google account has been removed.",
      });
    } catch (error) {
      console.error("Error disconnecting Google:", error);
      toast({
        title: "Error disconnecting",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveN8n = () => {
    saveIntegration("n8n", {
      mcp_url: n8nMcpUrl,
    });
  };

  const handleSaveSlack = () => {
    saveIntegration("slack", {
      bot_token: slackBotToken,
      signing_secret: slackSigningSecret,
      notification_channel: slackNotificationChannel,
    });
  };

  const handleSaveSeventime = () => {
    saveIntegration("seventime", {
      default_user_id: seventimeDefaultUserId,
      customer_responsible_id: seventimeCustomerResponsibleId,
      parttime_users: seventimeParttimeUsers,
    });
  };

  const handleLinkSlack = async () => {
    if (!user || !slackUserId || !slackWorkspaceId) {
      toast({
        title: "Missing information",
        description: "Please enter both your Slack User ID and Workspace ID.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Check if mapping exists
      const query = supabase
        .from("slack_user_mappings")
        .select("id")
        .eq("user_id", user.id);

      if (isOrgContext && currentOrg) {
        query.eq("organization_id", currentOrg.id);
      } else {
        query.is("organization_id", null);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("slack_user_mappings")
          .update({
            slack_user_id: slackUserId,
            slack_workspace_id: slackWorkspaceId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("slack_user_mappings")
          .insert([{
            user_id: user.id,
            organization_id: isOrgContext && currentOrg ? currentOrg.id : null,
            slack_user_id: slackUserId,
            slack_workspace_id: slackWorkspaceId,
          }]);

        if (error) throw error;
      }

      setSlackLinked(true);
      toast({
        title: "Slack account linked",
        description: `Your Slack account is now linked for ${contextLabel}.`,
      });
    } catch (error) {
      console.error("Error linking Slack account:", error);
      toast({
        title: "Error linking Slack",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkSlack = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const query = supabase
        .from("slack_user_mappings")
        .delete()
        .eq("user_id", user.id);

      if (isOrgContext && currentOrg) {
        query.eq("organization_id", currentOrg.id);
      } else {
        query.is("organization_id", null);
      }

      const { error } = await query;
      if (error) throw error;

      setSlackUserId("");
      setSlackWorkspaceId("");
      setSlackLinked(false);
      toast({
        title: "Slack account unlinked",
        description: "Your Slack account has been disconnected.",
      });
    } catch (error) {
      console.error("Error unlinking Slack:", error);
      toast({
        title: "Error unlinking Slack",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleShowSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
        <AlertCircle className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Configuring integrations for: <strong className="text-foreground">{contextLabel}</strong>
        </span>
      </div>

      <Tabs defaultValue="google" className="space-y-4">
        <TabsList>
          <TabsTrigger value="google">Google</TabsTrigger>
          <TabsTrigger value="n8n">n8n</TabsTrigger>
          <TabsTrigger value="slack">Slack</TabsTrigger>
          <TabsTrigger value="seventime">SevenTime</TabsTrigger>
        </TabsList>

        <TabsContent value="google">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <img 
                  src="https://www.google.com/favicon.ico" 
                  alt="Google" 
                  className="h-5 w-5"
                />
                Google OAuth
              </CardTitle>
              <CardDescription>
                Connect your Google account for Drive, Calendar, and Gmail integration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Connected Accounts Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Connected Accounts</Label>
                  <Button 
                    onClick={handleConnectGoogle} 
                    disabled={connectingGoogle}
                    size="sm"
                  >
                    {connectingGoogle ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Link2 className="h-4 w-4 mr-2" />
                    )}
                    Connect Google Account
                  </Button>
                </div>
                
                {connectedGoogleAccounts.length > 0 ? (
                  <div className="space-y-2">
                    {connectedGoogleAccounts.map((account) => (
                      <div 
                        key={account.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <img 
                              src="https://www.google.com/favicon.ico" 
                              alt="Google" 
                              className="h-4 w-4"
                            />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {account.google_email || account.display_name || "Google Account"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Connected {new Date(account.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDisconnectGoogle(account.id)}
                          disabled={saving}
                        >
                          <Unlink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border border-dashed border-border text-center">
                    <p className="text-sm text-muted-foreground">
                      No Google accounts connected for {contextLabel}.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Click "Connect Google Account" to get started.
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground mb-2">
                  <strong>Note:</strong> Your OAuth credentials are configured globally. Click connect to authorize access.
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Redirect URI:</strong>{" "}
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">
                    https://pccvvqmrwbcdjgkyteqn.supabase.co/functions/v1/google-oauth
                  </code>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="n8n">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                n8n Workflows
              </CardTitle>
              <CardDescription>
                Connect your n8n instance to enable AI tool calling for email, calendar, and more.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="n8n-mcp-url">MCP Server URL</Label>
                <div className="relative">
                  <Input
                    id="n8n-mcp-url"
                    type={showSecrets["n8n-url"] ? "text" : "password"}
                    value={n8nMcpUrl}
                    onChange={(e) => setN8nMcpUrl(e.target.value)}
                    placeholder="https://your-n8n.app/mcp/xxxxx"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => toggleShowSecret("n8n-url")}
                  >
                    {showSecrets["n8n-url"] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={handleSaveN8n} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Save n8n Settings
                </Button>
              </div>

              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
                <p><strong>Setup Instructions:</strong></p>
                <ol className="list-decimal list-inside ml-2 space-y-1">
                  <li>Go to Settings → MCP access in your n8n instance</li>
                  <li>Enable MCP access and copy the MCP URL</li>
                  <li>For each workflow, enable "Available in MCP" in workflow settings</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slack">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-lg">💬</span>
                Slack Integration
              </CardTitle>
              <CardDescription>
                Connect Slack to interact with your AI assistant from any channel.
                Create a Slack app at <a 
                  href="https://api.slack.com/apps" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  api.slack.com/apps
                </a>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="slack-bot-token">Bot User OAuth Token</Label>
                <div className="relative">
                  <Input
                    id="slack-bot-token"
                    type={showSecrets["slack-token"] ? "text" : "password"}
                    value={slackBotToken}
                    onChange={(e) => setSlackBotToken(e.target.value)}
                    placeholder="xoxb-xxxxxxxx-xxxxxxxx"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => toggleShowSecret("slack-token")}
                  >
                    {showSecrets["slack-token"] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="slack-signing-secret">Signing Secret</Label>
                <div className="relative">
                  <Input
                    id="slack-signing-secret"
                    type={showSecrets["slack-secret"] ? "text" : "password"}
                    value={slackSigningSecret}
                    onChange={(e) => setSlackSigningSecret(e.target.value)}
                    placeholder="xxxxxxxxxxxxxxxxxxxxxxxx"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => toggleShowSecret("slack-secret")}
                  >
                    {showSecrets["slack-secret"] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="slack-notification-channel">Notification Channel ID</Label>
                <Input
                  id="slack-notification-channel"
                  type="text"
                  value={slackNotificationChannel}
                  onChange={(e) => setSlackNotificationChannel(e.target.value)}
                  placeholder="C0XXXXXXX"
                />
                <p className="text-xs text-muted-foreground">
                  Channel ID for task deadline notifications. Right-click channel → View channel details → Copy ID at bottom.
                </p>
              </div>

              <div className="pt-2">
                <Button onClick={handleSaveSlack} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Save Slack Settings
                </Button>
              </div>

              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
                <p><strong>Setup Instructions:</strong></p>
                <ol className="list-decimal list-inside ml-2 space-y-1">
                  <li>Create app at api.slack.com/apps → "From scratch"</li>
                  <li>Go to OAuth & Permissions → Add scopes: app_mentions:read, channels:history, chat:write, users:read</li>
                  <li>Enable Event Subscriptions → Request URL: <code className="bg-muted px-1 rounded">https://pccvvqmrwbcdjgkyteqn.supabase.co/functions/v1/slack-webhook</code></li>
                  <li>Subscribe to bot events: app_mention, message.channels</li>
                  <li>Install to workspace and copy Bot Token (xoxb-...) and Signing Secret</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Account Linking Section */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-lg">🔗</span>
                Link Your Slack Account
              </CardTitle>
              <CardDescription>
                Connect your Slack user to receive AI responses in Slack.
                {slackLinked && <span className="ml-2 text-green-500">✓ Linked</span>}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="slack-user-id">Your Slack Member ID</Label>
                  <Input
                    id="slack-user-id"
                    value={slackUserId}
                    onChange={(e) => setSlackUserId(e.target.value)}
                    placeholder="U0XXXXXXXXX"
                  />
                  <p className="text-xs text-muted-foreground">
                    Click your profile → "..." → "Copy member ID"
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="slack-workspace-id">Workspace ID</Label>
                  <Input
                    id="slack-workspace-id"
                    value={slackWorkspaceId}
                    onChange={(e) => setSlackWorkspaceId(e.target.value)}
                    placeholder="T0XXXXXXXXX"
                  />
                  <p className="text-xs text-muted-foreground">
                    Found in Slack app settings under "Basic Information"
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleLinkSlack} disabled={saving || !slackUserId || !slackWorkspaceId}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  {slackLinked ? "Update Link" : "Link Account"}
                </Button>
                {slackLinked && (
                  <Button variant="outline" onClick={handleUnlinkSlack} disabled={saving}>
                    Unlink
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seventime">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-lg">🔧</span>
                SevenTime Integration
              </CardTitle>
              <CardDescription>
                Configure SevenTime integration for work order management.
                Get your API key from SevenTime Settings → Integrations → API.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seventime-default-user">Default User ID (Yousif)</Label>
                <Input
                  id="seventime-default-user"
                  value={seventimeDefaultUserId}
                  onChange={(e) => setSeventimeDefaultUserId(e.target.value)}
                  placeholder="SevenTime User ID"
                />
                <p className="text-xs text-muted-foreground">
                  User ID for creating orders and customers. Find in SevenTime user settings.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seventime-customer-responsible">Customer Responsible ID (Lai)</Label>
                <Input
                  id="seventime-customer-responsible"
                  value={seventimeCustomerResponsibleId}
                  onChange={(e) => setSeventimeCustomerResponsibleId(e.target.value)}
                  placeholder="SevenTime User ID for customer responsible"
                />
                <p className="text-xs text-muted-foreground">
                  User ID assigned as customer responsible (Kundansvarig).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seventime-parttime-users">Part-Time Users (EMS)</Label>
                <Input
                  id="seventime-parttime-users"
                  value={seventimeParttimeUsers}
                  onChange={(e) => setSeventimeParttimeUsers(e.target.value)}
                  placeholder="User ID 1, User ID 2"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of user IDs for part-time workers on work orders.
                </p>
              </div>

              <div className="pt-2">
                <Button onClick={handleSaveSeventime} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Save SevenTime Settings
                </Button>
              </div>

              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
                <p><strong>How to find User IDs in SevenTime:</strong></p>
                <ol className="list-decimal list-inside ml-2 space-y-1">
                  <li>Go to Settings → Users in SevenTime</li>
                  <li>Click on a user to view their details</li>
                  <li>Copy the ID from the URL or API response</li>
                </ol>
                <p className="pt-2"><strong>Note:</strong> The API key is configured as an environment secret (SEVENTIME_API_KEY).</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
