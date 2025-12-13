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
import { Loader2, Eye, EyeOff, Check, AlertCircle } from "lucide-react";

interface IntegrationConfig {
  google?: {
    client_id?: string;
    client_secret?: string;
  };
  n8n?: {
    mcp_url?: string;
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

  const isOrgContext = context.mode === "organization" && currentOrg;
  const contextLabel = isOrgContext ? currentOrg.name : "Personal";

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user, context]);

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
        }
      });
    } catch (error) {
      console.error("Error fetching integration settings:", error);
    } finally {
      setLoading(false);
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

  const handleSaveN8n = () => {
    saveIntegration("n8n", {
      mcp_url: n8nMcpUrl,
    });
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
                Configure Google OAuth for Drive, Calendar, and Gmail integration.
                Get credentials from the <a 
                  href="https://console.cloud.google.com/apis/credentials" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Google Cloud Console
                </a>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="google-client-id">Client ID</Label>
                <Input
                  id="google-client-id"
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  placeholder="xxxxxxxx.apps.googleusercontent.com"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="google-client-secret">Client Secret</Label>
                <div className="relative">
                  <Input
                    id="google-client-secret"
                    type={showSecrets["google-secret"] ? "text" : "password"}
                    value={googleClientSecret}
                    onChange={(e) => setGoogleClientSecret(e.target.value)}
                    placeholder="GOCSPX-xxxxxxxx"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => toggleShowSecret("google-secret")}
                  >
                    {showSecrets["google-secret"] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={handleSaveGoogle} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Save Google Settings
                </Button>
              </div>

              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
                <p><strong>Required OAuth Scopes:</strong></p>
                <ul className="list-disc list-inside ml-2">
                  <li>https://www.googleapis.com/auth/drive</li>
                  <li>https://www.googleapis.com/auth/calendar</li>
                  <li>https://www.googleapis.com/auth/gmail.send</li>
                  <li>https://www.googleapis.com/auth/userinfo.email</li>
                </ul>
                <p className="pt-2"><strong>Authorized Redirect URI:</strong></p>
                <code className="block bg-muted px-2 py-1 rounded text-xs">
                  https://pccvvqmrwbcdjgkyteqn.supabase.co/functions/v1/google-oauth
                </code>
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
      </Tabs>
    </div>
  );
};
