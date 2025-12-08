import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Server, Brain, Database, Building2 } from "lucide-react";
import { OrganizationSettings } from "@/components/organization/OrganizationSettings";
import { useAuth } from "@/hooks/useAuth";
import { AuthForm } from "@/components/auth/AuthForm";

const Settings = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm onSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => (window.location.href = "/")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Chat
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Configure your Second Brain assistant
          </p>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="organization" className="gap-2">
              <Building2 className="h-4 w-4" />
              Organization
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            {/* Backend Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Backend Service
                </CardTitle>
                <CardDescription>
                  Cloud backend powered by Lovable Cloud
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Status</span>
                    <span className="text-sm text-green-500 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      Connected
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">AI Model</span>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      google/gemini-2.5-flash
                    </code>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Configuration
                </CardTitle>
                <CardDescription>
                  Customize how your AI assistant behaves
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  AI configuration options coming soon.
                </p>
              </CardContent>
            </Card>

            {/* Data & Storage */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Data & Storage
                </CardTitle>
                <CardDescription>
                  Your data is securely stored in the cloud
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Storage</span>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      Cloud Database
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    All data is encrypted and stored securely in your personal cloud space.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="organization">
            <OrganizationSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
